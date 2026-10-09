// Saves and reloads Bitsy games on the signed-in Chili account.
(function () {
  var params = new URLSearchParams(window.location.search);
  var apiBase = (params.get("api") || "/api").replace(/\/$/, "");
  var projectId = params.get("project");
  var owner = "";
  var me = "";
  var projects = [];
  var listeners = [];
  var booted = false;
  var applying = false;
  var refreshing = false;
  var saveTimer = null;
  // Save status: "saved", "unsaved", "saving" or "error". Every edit bumps
  // editRevision; a save that finishes records the revision it sent, so edits
  // made while a save is in flight still count as unsaved.
  var saveState = "saved";
  var saveError = "";
  var editRevision = 0;
  var savedRevision = 0;
  var inFlight = null;

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

  // Show feedback in the app's toast stack when embedded; fall back to an alert.
  function notify(kind, message) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "chili-toast", kind: kind, message: message }, window.location.origin);
    } else {
      window.alert(message);
    }
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
      save: { state: saveState, error: saveError, isNew: !projectId },
    };
    listeners.forEach(function (listener) {
      listener(snapshot);
    });
  }

  function isDirty() {
    return editRevision !== savedRevision;
  }

  function hasUnsavedWork() {
    return isDirty() || !!inFlight;
  }

  // Updates the save status and tells the platform page, which warns before
  // leaving the creator while work is unsaved.
  function setSaveState(state, error) {
    saveState = state;
    saveError = error || "";
    emit();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "chili-save-state", state: state, unsaved: hasUnsavedWork() },
        window.location.origin
      );
    }
  }

  // Marks everything in the editor as saved, after a load or a fresh save.
  function markClean() {
    clearTimeout(saveTimer);
    saveTimer = null;
    savedRevision = editRevision;
    setSaveState("saved");
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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      flush().catch(function () {});
    }, 700);
  }

  function markEdited() {
    if (!booted || applying || refreshing || (typeof isPlayMode !== "undefined" && isPlayMode)) {
      return;
    }
    editRevision++;
    // Like a docs app, edits show as saving straight away: the save follows
    // once typing pauses. After a failed save the error stays up until a
    // save goes through.
    if (saveState !== "error") {
      setSaveState("saving");
    }
    scheduleSave();
  }

  // Saves the latest edits now. Waits for a save already in flight, so two
  // requests never race (a racing POST would create the game twice).
  // `options.force` saves even with no new edits; the rest go to save().
  function flush(options) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (inFlight) {
      return inFlight.catch(function () {}).then(function () {
        return flush(options);
      });
    }
    if (!isDirty() && !(options && options.force)) {
      return Promise.resolve(null);
    }
    var revision = editRevision;
    var wasFailing = saveState === "error";
    setSaveState("saving");
    inFlight = Promise.resolve().then(function () {
      return save(options);
    }).then(function (game) {
      inFlight = null;
      if (!game) {
        // A new game whose title is already taken waits for an explicit save.
        setSaveState(isDirty() ? "unsaved" : "saved");
        return null;
      }
      savedRevision = revision;
      if (isDirty()) {
        // More edits came in during the save; the next one is already queued.
        setSaveState("saving");
        if (!saveTimer) {
          scheduleSave();
        }
      } else {
        setSaveState("saved");
      }
      return game;
    }, function (err) {
      inFlight = null;
      var message = err && err.message ? err.message : "save failed";
      if (!wasFailing) {
        notify("error", "Could not save your game: " + message);
      }
      setSaveState("error", message);
      throw err;
    });
    return inFlight;
  }

  // Before swapping the game in the editor, save what is there. If that save
  // fails, ask before throwing the edits away.
  function settle() {
    if (!hasUnsavedWork()) {
      return Promise.resolve(true);
    }
    return flush().then(function () {
      return !isDirty() || confirm("Your latest changes are not saved yet. Discard them?");
    }, function () {
      return confirm("Your latest changes could not be saved. Discard them?");
    });
  }

  var editorRefresh = refreshGameData;
  refreshGameData = function () {
    editorRefresh();
    if (!refreshing) {
      markEdited();
    }
  };

  // Warn when the editor page itself is closed or reloaded with unsaved work.
  // Embedded in the platform, the page around it warns too.
  window.addEventListener("beforeunload", function (event) {
    if (!hasUnsavedWork()) {
      return;
    }
    flush().catch(function () {});
    event.preventDefault();
    event.returnValue = "";
  });

  window.addEventListener("online", function () {
    if (saveState === "error") {
      flush().catch(function () {});
    }
  });

  function refresh() {
    return meName().then(function (username) {
      return apiFetch("/games/?username=" + encodeURIComponent(username) + "&released=false");
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
    return settle().then(function (ok) {
      if (!ok) {
        return;
      }
      applying = true;
      return load(id).then(function () {
        markClean();
      }).finally(function () {
        applying = false;
      });
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
    return settle().then(function (ok) {
      return ok ? createAndSave() : null;
    });
  }

  function createAndSave() {
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
    editRevision++;
    return flush({ forceNew: true, notify: false }).then(function (game) {
      if (!game || !game.id) {
        return null;
      }
      applying = true;
      syncTitle("game #" + game.id);
      applying = false;
      editRevision++;
      return flush();
    });
  }

  function create() {
    applying = true;
    projectId = null;
    if (typeof setDefaultGameState === "function") {
      setDefaultGameState();
    }
    applying = false;
    markClean();
    window.parent.postMessage({ type: "chili-project-new" }, window.location.origin);
    emit();
  }

  var editorStart = start;
  start = function () {
    editorStart();
    var pending = projectId ? load(projectId) : Promise.resolve();
    pending.then(function () {
      booted = true;
      markClean();
      return refresh();
    }).catch(function (err) {
      booted = true;
      notify("error", err && err.message ? err.message : "Could not open this project.");
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
      notify("info", "Nothing is playing yet.");
      return;
    }
    var image = canvas.toDataURL("image/png");
    var ready = projectId ? Promise.resolve() : flush({ force: true });
    ready
      .then(function () {
        return patch({ cover: image });
      })
      .then(function () {
        notify("success", "Saved this frame as the game image.");
      })
      .catch(function (err) {
        notify("error", err && err.message ? err.message : "Could not save the image.");
      });
  }

  function remove() {
    if (!projectId) {
      notify("info", "This game is not on your profile yet.");
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
      markClean();
      notify("success", "Game removed from your profile.");
      window.parent.postMessage({ type: "chili-project-removed" }, window.location.origin);
    }).catch(function (err) {
      notify("error", err && err.message ? err.message : "Could not remove this game.");
    });
  }

  window.ChiliProjects = {
    save: save,
    // Saves now, asking before saving a new game under a title already used.
    saveNow: function () {
      return flush({ confirmTitle: true, force: true });
    },
    saveState: function () {
      return saveState;
    },
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
