// Saves and reloads Bitsy games on the signed-in Chili account.
(function () {
  var params = new URLSearchParams(window.location.search);
  var apiBase = (params.get("api") || "/api").replace(/\/$/, "");
  var projectId = params.get("project");
  var owner = "";
  var me = "";
  var projects = [];
  var statusText = "Changes save automatically.";
  var listeners = [];
  var booted = false;
  var applying = false;
  var refreshing = false;
  var saveTimer = null;

  function token() {
    return localStorage.getItem("chili.accessToken");
  }

  function headers(json) {
    var result = {};
    if (json) {
      result["Content-Type"] = "application/json";
    }
    var access = token();
    if (access) {
      result.Authorization = "Bearer " + access;
    }
    return result;
  }

  var refreshingToken = null;

  function refreshAccessToken() {
    var refresh = localStorage.getItem("chili.refreshToken");
    if (!refresh) {
      return Promise.resolve(false);
    }
    if (!refreshingToken) {
      refreshingToken = fetch(apiBase + "/auth/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refresh }),
      }).then(function (response) {
        if (!response.ok) {
          return false;
        }
        return response.json().then(function (body) {
          if (body && body.access) {
            localStorage.setItem("chili.accessToken", body.access);
            return true;
          }
          return false;
        });
      }).catch(function () {
        return false;
      }).finally(function () {
        refreshingToken = null;
      });
    }
    return refreshingToken;
  }

  function apiFetch(path, options, allowRetry) {
    if (!token()) {
      return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({}); } });
    }
    var request = options || {};
    request.headers = Object.assign(headers(false), request.headers || {});
    return fetch(apiBase + path, request).then(function (response) {
      if (response.status === 401 && allowRetry !== false) {
        return refreshAccessToken().then(function (ok) {
          if (!ok) {
            return response;
          }
          return apiFetch(path, options, false);
        });
      }
      return response;
    });
  }

  function titleOfGame() {
    var title = typeof getTitle === "function" ? getTitle() : "";
    title = String(title || "").split("\n")[0].trim();
    return title || "untitled";
  }

  function applyGame(data) {
    if (typeof Store === "undefined" || typeof on_game_data_change !== "function") {
      return;
    }
    applying = true;
    Store.set("game_data", data);
    on_game_data_change();
    applying = false;
  }

  function emit() {
    var current = null;
    if (projectId) {
      current = projects.find(function (project) {
        return String(project.id) === String(projectId);
      }) || { id: projectId, title: titleOfGame() };
    }
    var snapshot = {
      current: current,
      projects: projects.slice(),
      status: statusText,
    };
    listeners.forEach(function (listener) {
      listener(snapshot);
    });
  }

  function meName() {
    if (me) {
      return Promise.resolve(me);
    }
    return apiFetch("/profiles/me/")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Sign in to see your projects.");
        }
        return response.json();
      })
      .then(function (profile) {
        me = profile.username;
        return me;
      });
  }

  function remember(game) {
    var next = {
      id: game.id,
      title: game.title,
      slug: game.slug,
      owner: game.owner,
      cover: game.cover || "",
      updated_at: game.updated_at,
    };
    var index = projects.findIndex(function (project) {
      return String(project.id) === String(game.id);
    });
    if (index >= 0) {
      projects[index] = next;
    } else {
      projects.unshift(next);
    }
  }

  function load(id) {
    return apiFetch("/games/" + id + "/")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("could not open this project");
        }
        return response.json();
      })
      .then(function (game) {
        projectId = String(game.id);
        owner = game.owner || "";
        applyGame(game.data || "");
      });
  }

  function save(options) {
    var askAboutTitle = options && options.confirmTitle;
    var forceNew = options && options.forceNew;
    var notify = !options || options.notify !== false;
    if (forceNew) {
      projectId = null;
    }
    if (typeof refreshGameData === "function") {
      refreshing = true;
      refreshGameData();
      refreshing = false;
    }
    if (!token()) {
      return Promise.reject(new Error("Sign in to save this game to your profile."));
    }
    var title = titleOfGame();
    var sameTitle = projects.find(function (project) {
      return String(project.id) !== String(projectId || "") &&
        String(project.title || "").trim().toLowerCase() === title.toLowerCase();
    });
    if (sameTitle && !projectId && !forceNew) {
      if (!askAboutTitle) {
        return Promise.resolve(null);
      }
      var proceed = confirm(
        "A game named “" + title + "” is already saved as #" + sameTitle.id +
        ". Save this as a new game?"
      );
      if (!proceed) {
        return Promise.resolve(null);
      }
    }
    var payload = {
      title: title,
      data: serializeWorld(true),
    };
    var url = apiBase + "/games/";
    var method = "POST";
    if (projectId) {
      url += projectId + "/";
      method = "PUT";
    }
    function send(nextUrl, nextMethod) {
      return apiFetch(nextUrl.replace(apiBase, ""), {
        method: nextMethod,
        headers: headers(true),
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            var detail = body && (body.detail || body.title || body.data);
            if (Array.isArray(detail)) {
              detail = detail.join(" ");
            }
            throw new Error(detail || "save failed");
          }
          return body;
        });
      });
    }

    return send(url, method)
      .then(function (game) {
        projectId = String(game.id);
        owner = game.owner || owner;
        remember(game);
        if (notify) {
          window.parent.postMessage(
            { type: "chili-project", id: game.id },
            window.location.origin
          );
        }
        emit();
        return game;
      });
  }

  function scheduleSave() {
    if (!booted || applying || refreshing || (typeof isPlayMode !== "undefined" && isPlayMode)) {
      return;
    }
    statusText = "Saving…";
    emit();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      save().then(function () {
        statusText = "Saved";
        emit();
      }).catch(function () {
        statusText = "Could not save";
        emit();
      });
    }, 700);
  }

  var editorRefresh = refreshGameData;
  refreshGameData = function () {
    editorRefresh();
    if (!refreshing) {
      scheduleSave();
    }
  };

  function refresh() {
    return meName().then(function (username) {
      return apiFetch("/games/?username=" + encodeURIComponent(username));
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("could not load projects");
      }
      return response.json();
    }).then(function (payload) {
      projects = payload.results || payload;
      emit();
    }).catch(function () {
      emit();
    });
  }

  function open(id) {
    applying = true;
    return load(id).then(function () {
      statusText = "Saved";
      emit();
    }).finally(function () {
      applying = false;
    });
  }

  function syncTitle(title) {
    if (typeof setTitle === "function") {
      setTitle(title);
    }
    if (typeof events !== "undefined" && events.Raise) {
      events.Raise("game_data_change", {});
      events.Raise("dialog_update", { dialogId: typeof titleDialogId !== "undefined" ? titleDialogId : "0" });
    }
  }

  function startNew() {
    applying = true;
    clearTimeout(saveTimer);
    projectId = null;
    if (typeof setDefaultGameState === "function") {
      setDefaultGameState();
    }
    if (typeof on_game_data_change === "function") {
      on_game_data_change();
    }
    applying = false;
    return save({ forceNew: true, notify: false }).then(function (game) {
      if (!game || !game.id) {
        return null;
      }
      applying = true;
      syncTitle("game #" + game.id);
      applying = false;
      return save();
    });
  }

  function create() {
    applying = true;
    projectId = null;
    if (typeof setDefaultGameState === "function") {
      setDefaultGameState();
    }
    applying = false;
    statusText = "New project. Edits will be saved to your profile.";
    window.parent.postMessage({ type: "chili-project-new" }, window.location.origin);
    emit();
  }

  var editorStart = start;
  start = function () {
    editorStart();
    var pending = projectId ? load(projectId) : Promise.resolve();
    pending.then(function () {
      booted = true;
      statusText = projectId ? "Saved" : "New project. Edits will be saved to your profile.";
      return refresh();
    }).catch(function (err) {
      booted = true;
      window.alert(err && err.message ? err.message : "could not open this project");
      emit();
    });
  };

  function patch(body) {
    return apiFetch("/games/" + projectId + "/", {
      method: "PATCH",
      headers: headers(true),
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.detail) || "could not update this game");
        }
        return payload;
      });
    });
  }

  function captureCover() {
    if (typeof isPlayMode !== "undefined" && !isPlayMode) {
      return;
    }
    var canvas = document.querySelector("#roomPanel canvas");
    if (!canvas) {
      window.alert("Nothing is playing yet.");
      return;
    }
    var image = canvas.toDataURL("image/png");
    var ready = projectId ? Promise.resolve() : save();
    ready
      .then(function () {
        return patch({ cover: image });
      })
      .then(function () {
        window.alert("Saved this frame as the game image.");
      })
      .catch(function (err) {
        window.alert(err && err.message ? err.message : "could not save the image");
      });
  }

  function remove() {
    if (!projectId) {
      window.alert("This game is not on your profile yet.");
      return;
    }
    if (!confirm("Remove this game from your profile?")) {
      return;
    }
    var removedId = projectId;
    apiFetch("/games/" + projectId + "/", {
      method: "DELETE",
    }).then(function (response) {
      if (!response.ok && response.status !== 204) {
        throw new Error("could not remove this game");
      }
      projectId = null;
      projects = projects.filter(function (project) {
        return String(project.id) !== String(removedId);
      });
      statusText = "Removed";
      emit();
      window.parent.postMessage({ type: "chili-project-removed" }, window.location.origin);
    }).catch(function (err) {
      window.alert(err && err.message ? err.message : "could not remove this game");
    });
  }

  window.ChiliProjects = {
    save: save,
    remove: remove,
    captureCover: captureCover,
    open: open,
    create: create,
    startNew: startNew,
    refresh: refresh,
    watch: function (listener) {
      listeners.push(listener);
      emit();
    },
    id: function () {
      return projectId;
    },
  };
})();
