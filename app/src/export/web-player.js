// The player inside an exported game page. A plain script with no imports:
// the page holds citsy.js, citsy.wasm (base64) and the game, and works
// offline. Arrows or WASD move, Space or Enter talks; on a touch screen,
// drag to move and tap to talk.
(function () {
  var SIZE = 128;
  var keys = {
    arrowup: 0, w: 0, arrowdown: 1, s: 1, arrowleft: 2, a: 2, arrowright: 3, d: 3,
    ' ': 4, enter: 4, z: 4, x: 4, escape: 5,
  };
  var canvas = document.getElementById('game');
  var context = canvas.getContext('2d');
  var image = context.createImageData(SIZE, SIZE);
  var data = document.getElementById('exportedGameData').textContent.replace(/<\\\/script/gi, '</script');
  var held = [false, false, false, false, false, false];
  var tapped = false;
  var synth = null;

  function wasmBytes() {
    var text = atob(document.getElementById('citsyWasm').textContent.trim());
    var bytes = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes;
  }

  function pulseWave(audio, pulse) {
    var duty = [1 / 8, 1 / 4, 1 / 2][pulse] || 0.5;
    var real = new Float32Array(32);
    var imag = new Float32Array(32);
    for (var n = 1; n < 32; n++) {
      real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
    }
    return audio.createPeriodicWave(real, imag);
  }

  // Sound starts on the first key or touch, as browsers ask.
  function startSound() {
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (synth || !Audio) return;
    var audio = new Audio();
    var waves = [0, 1, 2].map(function (p) { return pulseWave(audio, p); });
    synth = [0, 1].map(function () {
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      gain.gain.value = 0;
      osc.setPeriodicWave(waves[2]);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      return { osc: osc, gain: gain, waves: waves, pulse: 2 };
    });
    if (audio.state === 'suspended') audio.resume();
  }

  function playSound(s) {
    if (!synth) return;
    synth.forEach(function (voice, i) {
      var at = i * 4;
      if (!(s[at] > 0 && s[at + 1] > 0 && s[at + 2] > 0)) {
        voice.gain.gain.value = 0;
        return;
      }
      var pulse = Math.round(s[at + 3]);
      if (pulse !== voice.pulse && voice.waves[pulse]) {
        voice.pulse = pulse;
        voice.osc.setPeriodicWave(voice.waves[pulse]);
      }
      voice.osc.frequency.value = s[at + 1];
      voice.gain.gain.value = Math.min(0.15, s[at + 2] * 0.12);
    });
  }

  document.addEventListener('keydown', function (event) {
    startSound();
    var button = keys[event.key.toLowerCase()];
    if (button === undefined) return;
    event.preventDefault();
    held[button] = true;
  });
  document.addEventListener('keyup', function (event) {
    var button = keys[event.key.toLowerCase()];
    if (button !== undefined) held[button] = false;
  });

  var touch = null;
  function release() {
    for (var i = 0; i < 4; i++) held[i] = false;
  }
  canvas.addEventListener('pointerdown', function (event) {
    startSound();
    touch = { x: event.clientX, y: event.clientY, moved: false };
  });
  canvas.addEventListener('pointermove', function (event) {
    if (!touch) return;
    var dx = event.clientX - touch.x;
    var dy = event.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    touch.moved = true;
    release();
    held[Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 1 : 0] = true;
  });
  function lift() {
    if (touch && !touch.moved) tapped = true;
    touch = null;
    release();
  }
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  function fail(message) {
    document.getElementById('message').textContent = message;
  }

  var bytes = wasmBytes();
  CitsyModule({
    instantiateWasm: function (imports, done) {
      WebAssembly.instantiate(bytes, imports).then(function (result) { done(result.instance); }, function (err) { fail(String(err)); });
      return {};
    },
  }).then(function (module) {
    function call(name, returns, types, values) {
      return module.ccall(name, returns, types || [], values || []);
    }
    function load() {
      if (call('citsy_load', 'number', ['string'], [data]) === 1) return true;
      fail('This game could not start: ' + call('citsy_last_error', 'string'));
      return false;
    }
    if (!load()) return;
    var previous = null;
    function frame(now) {
      var dt = previous === null ? 16.667 : Math.min(100, Math.max(0, now - previous));
      previous = now;
      for (var i = 0; i < 6; i++) call('citsy_set_button', null, ['number', 'number'], [i, held[i] || (i === 4 && tapped) ? 1 : 0]);
      tapped = false;
      var running = call('citsy_frame', 'number', ['number'], [dt]) === 1;
      var pixels = call('citsy_pixels', 'number');
      image.data.set(module.HEAPU8.subarray(pixels, pixels + SIZE * SIZE * 4));
      context.putImageData(image, 0, 0);
      var sound = call('citsy_sound', 'number') >> 2;
      playSound(module.HEAPF32.subarray(sound, sound + 8));
      // After the ending, the game starts again, as in Bitsy.
      if (!running) {
        call('citsy_unload', null);
        if (!load()) return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, function (err) { fail(String(err)); });
})();
