// The "load game" list of the classic editor (chili-creator#15).
//
// The platform's GET /games/ returns drafts only with released=false and
// released games only without it, 20 per page (PAGE_SIZE), while a creator
// may keep 30 games. So the list asks for both and reads every page, the way
// the platform's own /creator page does (chili-platform-frontend#97, #104).
// Page paths are built here (?page=N) instead of following the `next` link,
// whose host may not be the one the editor talks to.
(function (root) {
  "use strict";

  // A creator keeps at most 30 games; this only stops an API that never ends.
  var MAX_PAGES = 10;

  function gamesPath(username, released, page) {
    var path = "/games/?username=" + encodeURIComponent(username);
    if (!released) {
      path += "&released=false";
    }
    if (page > 1) {
      path += "&page=" + page;
    }
    return path;
  }

  function loadPages(fetchJson, username, released) {
    var games = [];
    function load(page) {
      return fetchJson(gamesPath(username, released, page)).then(function (payload) {
        if (Array.isArray(payload)) {
          return games.concat(payload);
        }
        games = games.concat((payload && payload.results) || []);
        if (payload && payload.next && page < MAX_PAGES) {
          return load(page + 1);
        }
        return games;
      });
    }
    return load(1);
  }

  function lastEdit(game) {
    var time = Date.parse(game.updated_at || game.created_at || "");
    return isNaN(time) ? 0 : time;
  }

  // A game released between the two requests comes back in both lists; the
  // released copy is the newer one, so it is kept.
  function merge(drafts, released) {
    var seen = {};
    var games = [];
    released.concat(drafts).forEach(function (game) {
      if (!game || seen[game.id]) {
        return;
      }
      seen[game.id] = true;
      games.push(game);
    });
    return games.sort(function (a, b) {
      return lastEdit(b) - lastEdit(a) || Number(b.id) - Number(a.id);
    });
  }

  function loadAll(fetchJson, username) {
    return Promise.all([
      loadPages(fetchJson, username, false),
      loadPages(fetchJson, username, true),
    ]).then(function (lists) {
      return merge(lists[0], lists[1]);
    });
  }

  root.ChiliProjectList = {
    MAX_PAGES: MAX_PAGES,
    gamesPath: gamesPath,
    loadAll: loadAll,
    merge: merge,
  };
})(typeof window !== "undefined" ? window : globalThis);
