// Chili Beat web player: runs the wasm engine, draws to a canvas, reads keys
// and plays sound. See docs/web.md.
//
//   import createChiliBeat from "./chili-beat.js";
//   import { ChiliBeatPlayer } from "./player.js";
//   const player = await ChiliBeatPlayer.create(createChiliBeat);
//   const error = player.load(text);
//   if (!error) player.start(canvas);

export const BUTTONS = { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32 };

const KEYS = {
  ArrowUp: BUTTONS.up, KeyW: BUTTONS.up,
  ArrowDown: BUTTONS.down, KeyS: BUTTONS.down,
  ArrowLeft: BUTTONS.left, KeyA: BUTTONS.left,
  ArrowRight: BUTTONS.right, KeyD: BUTTONS.right,
  KeyZ: BUTTONS.a, Space: BUTTONS.a, Enter: BUTTONS.a,
  KeyX: BUTTONS.b,
};

const SIZE = 128;
const STEP_MS = 1000 / 60;

export class ChiliBeatPlayer {
  static async create(createChiliBeat, options = {}) {
    return new ChiliBeatPlayer(await createChiliBeat(options));
  }

  constructor(module) {
    this.module = module;
    this.api = {
      load: module.cwrap("cb_load", "number", ["string"]),
      error: module.cwrap("cb_error", "number", []),
      step: module.cwrap("cb_step", null, ["number"]),
      restart: module.cwrap("cb_restart", null, []),
      rgba: module.cwrap("cb_rgba", "number", []),
      sound: module.cwrap("cb_sound", "number", []),
      debug: module.cwrap("cb_debug", "number", []),
    };
    this.buttons = 0;       // held now, from keys and press()
    this.tapped = 0;        // pressed since the last step, so a quick tap is not lost
    this.onStep = null;     // called with debug() after every step, if set
    this.muted = false;
    this.frame = null;
    this.synth = null;
  }

  // Loads .beat text. Returns null, or an error message.
  load(text) {
    return this.api.load(text) ? null : this.module.UTF8ToString(this.api.error());
  }

  restart() { this.api.restart(); }

  // One 1/60 s step with a button mask.
  step(buttons = this.buttons | this.tapped) {
    this.tapped = 0;
    this.api.step(buttons);
    if (this.onStep) this.onStep(this.debug());
  }

  // { state, screen, beat, counters, fired, sounds, text }
  debug() { return JSON.parse(this.module.UTF8ToString(this.api.debug())); }

  // The screen as 128 x 128 RGBA pixels.
  rgba() {
    const at = this.api.rgba();
    return new Uint8ClampedArray(this.module.HEAPU8.buffer, at, SIZE * SIZE * 4).slice();
  }

  // The 4 sound channels: { wave: 0 square | 1 triangle | 2 noise, volume 0-255, frequency Hz }.
  sound() {
    const at = this.api.sound();
    const h = this.module.HEAPU8;
    return [0, 1, 2, 3].map((i) => ({
      wave: h[at + i * 4],
      volume: h[at + i * 4 + 1],
      frequency: h[at + i * 4 + 2] | (h[at + i * 4 + 3] << 8),
    }));
  }

  // Press or release a button from your own controls (for example touch).
  press(button, down) {
    this.buttons = down ? this.buttons | button : this.buttons & ~button;
    if (down) this.tapped |= button;
  }

  // Runs the game in a canvas until stop(). Keys are read from `keys`.
  start(canvas, { keys = window } = {}) {
    this.stop();
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.imageRendering = "pixelated";
    const ctx = canvas.getContext("2d");
    const onKey = (event) => {
      const button = KEYS[event.code];
      if (!button) return;
      event.preventDefault();
      this.press(button, event.type === "keydown");
      this.#startSound();
    };
    keys.addEventListener("keydown", onKey);
    keys.addEventListener("keyup", onKey);
    const onBlur = () => { this.buttons = 0; };
    window.addEventListener("blur", onBlur);

    let last = performance.now();
    let behind = 0;
    const tick = (now) => {
      behind = Math.min(behind + now - last, 250);
      last = now;
      while (behind >= STEP_MS) {
        this.step();
        behind -= STEP_MS;
      }
      ctx.putImageData(new ImageData(this.rgba(), SIZE, SIZE), 0, 0);
      if (this.synth) this.synth.set(this.muted ? [] : this.sound());
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    this.cleanup = () => {
      keys.removeEventListener("keydown", onKey);
      keys.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
    if (this.synth) this.synth.set([]);
    this.buttons = 0;
  }

  /** Turns sound on now. Call it from a click or key press: browsers block sound before one. */
  enableSound() {
    this.#startSound();
  }

  // Browsers only allow sound after the player presses something.
  #startSound() {
    if (!this.synth && typeof AudioContext !== "undefined") this.synth = new Synth();
    if (this.synth) this.synth.resume();
  }
}

// Four channels, each with a square, a triangle and a noise voice.
class Synth {
  constructor() {
    this.ctx = new AudioContext();
    const master = this.ctx.createGain();
    master.gain.value = 0.2;
    master.connect(this.ctx.destination);

    const noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.channels = [0, 1, 2, 3].map(() => {
      const voices = ["square", "triangle", "noise"].map((type) => {
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.connect(master);
        let source;
        if (type === "noise") {
          source = this.ctx.createBufferSource();
          source.buffer = noise;
          source.loop = true;
        } else {
          source = this.ctx.createOscillator();
          source.type = type;
        }
        source.connect(gain);
        source.start();
        return { source, gain, type };
      });
      return voices;
    });
  }

  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  set(channels) {
    const t = this.ctx.currentTime;
    this.channels.forEach((voices, i) => {
      const c = channels[i] || { wave: 0, volume: 0, frequency: 0 };
      voices.forEach((voice, wave) => {
        const on = wave === c.wave && c.volume > 0 && c.frequency > 0;
        voice.gain.gain.setTargetAtTime(on ? c.volume / 255 : 0, t, 0.004);
        if (!on) return;
        if (voice.type === "noise") {
          voice.source.playbackRate.setTargetAtTime(Math.min(4, c.frequency / 4000), t, 0.004);
        } else {
          voice.source.frequency.setTargetAtTime(c.frequency, t, 0.002);
        }
      });
    });
  }
}
