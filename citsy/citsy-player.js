// Play-mode host for the Chili creator. Draws citsy's 128×128 framebuffer
// onto the Bitsy room canvas and maps keyboard input to citsy buttons.
(function () {
  var baseUrl = new URL(".", document.currentScript.src);
  var modulePromise = null;
  var mod = null;
  var api = null;
  var active = false;
  var session = 0;
  var raf = 0;
  var canvas = null;
  var ctx = null;
  var scratch = null;
  var scratchCtx = null;
  var frame = null;
  var keys = [false, false, false, false, false, false];
  var okPulse = false;
  var audio = null;
  var prevTime = 0;

  var KEY = {
    left: 37,
    right: 39,
    up: 38,
    down: 40,
    space: 32,
    enter: 13,
    w: 87,
    a: 65,
    s: 83,
    d: 68,
    z: 90,
    x: 88,
    escape: 27,
  };

  function ensureModule() {
    if (!modulePromise) {
      modulePromise = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = new URL("citsy.js", baseUrl).href;
        script.onload = function () {
          if (typeof CitsyModule !== "function") {
            reject(new Error("citsy runtime did not load"));
            return;
          }
          CitsyModule({
            locateFile: function (path) {
              return new URL(path, baseUrl).href;
            },
          }).then(resolve, reject);
        };
        script.onerror = function () {
          reject(new Error("failed to load citsy.js"));
        };
        document.head.appendChild(script);
      });
    }
    return modulePromise;
  }

  function bind(loaded) {
    mod = loaded;
    api = {
      load: function (text) {
        return loaded.ccall("citsy_load", "number", ["string"], [text]);
      },
      unload: function () {
        loaded.ccall("citsy_unload", null, [], []);
      },
      setButton: function (index, down) {
        loaded.ccall("citsy_set_button", null, ["number", "number"], [index, down]);
      },
      frame: function (dt) {
        return loaded.ccall("citsy_frame", "number", ["number"], [dt]);
      },
      pixels: function () {
        return loaded.ccall("citsy_pixels", "number", [], []);
      },
      sound: function () {
        return loaded.ccall("citsy_sound", "number", [], []);
      },
      error: function () {
        return loaded.ccall("citsy_last_error", "string", [], []);
      },
    };
  }

  function ensureAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audio) {
      var context = new AudioCtx();
      var channels = [0, 1].map(function () {
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = "square";
        osc.frequency.value = 440;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start();
        return { osc: osc, gain: gain };
      });
      audio = { context: context, channels: channels };
    }
    if (audio.context.state === "suspended") {
      audio.context.resume();
    }
  }

  function silence() {
    if (!audio) return;
    audio.channels.forEach(function (channel) {
      channel.gain.gain.value = 0;
    });
  }

  function applySound() {
    if (!audio || !api) return;
    var ptr = api.sound();
    if (!ptr) return;
    var values = mod.HEAPF32.subarray(ptr >> 2, (ptr >> 2) + 8);
    for (var i = 0; i < 2; i++) {
      var base = i * 4;
      var on = values[base] > 0 && values[base + 1] > 0 && values[base + 2] > 0;
      var channel = audio.channels[i];
      if (!on) {
        channel.gain.gain.value = 0;
        continue;
      }
      channel.osc.frequency.value = values[base + 1];
      channel.gain.gain.value = Math.min(0.15, values[base + 2] * 0.12);
    }
  }

  function paintLoading(message) {
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function blit() {
    var ptr = api.pixels();
    var src = mod.HEAPU8.subarray(ptr, ptr + 128 * 128 * 4);
    frame.data.set(src);
    scratchCtx.putImageData(frame, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
  }

  function pushButtons() {
    for (var i = 0; i < 4; i++) api.setButton(i, keys[i] ? 1 : 0);
    api.setButton(4, keys[4] || okPulse ? 1 : 0);
    api.setButton(5, keys[5] ? 1 : 0);
    okPulse = false;
  }

  function loop(now) {
    if (!active) return;
    var dt = prevTime ? Math.min(100, now - prevTime) : 16.667;
    prevTime = now;
    pushButtons();
    var running = api.frame(dt);
    blit();
    applySound();
    if (!running) {
      leavePlayMode();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function onKey(event, down) {
    if (!active) return;
    var code = event.keyCode;
    var index = -1;
    if (code === KEY.up || code === KEY.w) index = 0;
    else if (code === KEY.down || code === KEY.s) index = 1;
    else if (code === KEY.left || code === KEY.a) index = 2;
    else if (code === KEY.right || code === KEY.d) index = 3;
    else if (code === KEY.space || code === KEY.enter || code === KEY.z || code === KEY.x) index = 4;
    else if (code === KEY.escape) index = 5;
    if (index < 0) return;
    keys[index] = down;
    event.preventDefault();
  }

  function onKeyDown(event) { onKey(event, true); }
  function onKeyUp(event) { onKey(event, false); }
  function onPointerDown(event) {
    if (!active) return;
    okPulse = true;
    event.preventDefault();
  }

  function addListeners() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    if (canvas) canvas.addEventListener("pointerdown", onPointerDown);
  }

  function removeListeners() {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    if (canvas) canvas.removeEventListener("pointerdown", onPointerDown);
    keys = [false, false, false, false, false, false];
    okPulse = false;
  }

  function leavePlayMode() {
    stop();
    if (typeof on_edit_mode === "function") on_edit_mode();
    if (typeof updatePlayModeButton === "function") updatePlayModeButton();
  }

  function stop() {
    if (!active && !raf) {
      silence();
      return;
    }
    active = false;
    session++;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    prevTime = 0;
    removeListeners();
    silence();
    if (api) api.unload();
  }

  function start(nextCanvas, gameData) {
    var id = ++session;
    canvas = nextCanvas;
    ctx = canvas.getContext("2d");
    if (!scratch) {
      scratch = document.createElement("canvas");
      scratch.width = 128;
      scratch.height = 128;
      scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
      frame = scratchCtx.createImageData(128, 128);
    }
    active = true;
    addListeners();
    ensureAudio();
    paintLoading("loading citsy…");

    ensureModule().then(function (loaded) {
      if (id !== session) return;
      bind(loaded);
      var ok = api.load(gameData);
      if (!ok) {
        var message = api.error() || "citsy could not load this game";
        active = false;
        removeListeners();
        window.alert(message);
        if (typeof on_edit_mode === "function") on_edit_mode();
        if (typeof updatePlayModeButton === "function") updatePlayModeButton();
        return;
      }
      prevTime = 0;
      raf = requestAnimationFrame(loop);
    }).catch(function (err) {
      if (id !== session) return;
      active = false;
      removeListeners();
      window.alert(err && err.message ? err.message : "citsy failed to start");
      if (typeof on_edit_mode === "function") on_edit_mode();
      if (typeof updatePlayModeButton === "function") updatePlayModeButton();
    });
  }

  window.CitsyPlayer = {
    start: start,
    stop: stop,
    isActive: function () { return active; },
  };
})();
