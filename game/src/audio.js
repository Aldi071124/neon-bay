// Neon Bay — sound: everything is synthesized with WebAudio, no audio files.
// Engine hum, gunshots, punches, pickups, sirens and a small bassline loop
// that keeps the city moving. All of it is guarded: no audio context, no sound.

/** A tiny bass groove (A minor) and a hat pattern, one bar of 16 steps. */
const BASSLINE = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
const STEP_SECONDS = 0.16;

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Must be called from a user gesture at least once (browsers block audio). */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (started) return;
    started = true;
    startEngine();
    startMusic();
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  /** Engine pitch and volume follow how fast the player's car is going. */
  function engine(speed01) {
    if (!ctx || !engineGain) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.08);
    engineGain.gain.setTargetAtTime(muted ? 0 : 0.02 + speed01 * 0.05, t, 0.1);
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function startMusic() {
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const step = musicStep % 16;
      musicStep += 1;
      const bass = BASSLINE[step];
      if (bass) blip(bass, STEP_SECONDS * 1.8, 'triangle', 0.16);
      if (step % 4 === 2) noiseBurst(0.03, 0.05, 6000);
      if (step === 0 || step === 8) blip(220, 0.1, 'sine', 0.05, 110);
    }, STEP_SECONDS * 1000);
  }

  /** Two-tone siren while police are close; silent otherwise. */
  function siren(on) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = muted ? 0 : 0.045;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let high = false;
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && sirenOsc) {
      window.clearInterval(sirenTimer);
      sirenTimer = null;
      sirenOsc.stop();
      sirenOsc.disconnect();
      sirenOsc = null;
      sirenGain = null;
    }
  }

  return {
    unlock,
    engine,
    siren,
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
    },
    punch() {
      blip(90, 0.12, 'sine', 0.4, 45);
      noiseBurst(0.06, 0.2, 500);
    },
    crash(hard) {
      noiseBurst(hard ? 0.3 : 0.15, hard ? 0.5 : 0.25, 900);
      blip(70, 0.2, 'sine', 0.3, 35);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.25);
      window.setTimeout(() => blip(990, 0.12, 'sine', 0.25), 70);
    },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.25);
      window.setTimeout(() => blip(659, 0.12, 'triangle', 0.25), 110);
      window.setTimeout(() => blip(784, 0.22, 'triangle', 0.3), 220);
    },
    fail() {
      blip(220, 0.3, 'sawtooth', 0.2, 110);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
  };
}
