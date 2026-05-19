// Web Audio ambient synthesis. Zero external assets — every channel is
// procedurally generated. Channels share one lazily-created AudioContext.

let ctx = null;
const voices = new Map(); // channel id → AmbientVoice

function getContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

// Two seconds of approximated pink noise. Voss-McCartney algorithm.
function pinkNoiseBuffer(audio) {
  const sampleRate = audio.sampleRate;
  const buf = audio.createBuffer(1, sampleRate * 4, sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

function whiteNoiseBuffer(audio, seconds = 2) {
  const sampleRate = audio.sampleRate;
  const buf = audio.createBuffer(1, sampleRate * seconds, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

class Voice {
  constructor(audio, channelGain) {
    this.audio = audio;
    this.gain = audio.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(channelGain);
    this.nodes = [];
    this.timeouts = [];
  }
  setLevel(level) {
    const now = this.audio.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), now, 0.08);
  }
  destroy() {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    this.nodes.forEach((n) => {
      try { n.stop?.(); } catch { /* node may not be source */ }
      try { n.disconnect(); } catch { /* already disconnected */ }
    });
    this.nodes = [];
    try { this.gain.disconnect(); } catch { /* already disconnected */ }
  }
}

function createWind(audio, dest) {
  const v = new Voice(audio, dest);
  const src = audio.createBufferSource();
  src.buffer = pinkNoiseBuffer(audio);
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.2;
  const lfo = audio.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = audio.createGain();
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain).connect(filter.frequency);
  src.connect(filter).connect(v.gain);
  src.start();
  lfo.start();
  v.nodes = [src, lfo, lfoGain, filter];
  return v;
}

function createRain(audio, dest) {
  const v = new Voice(audio, dest);
  const src = audio.createBufferSource();
  src.buffer = whiteNoiseBuffer(audio, 2);
  src.loop = true;
  const lp = audio.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  lp.Q.value = 0.6;
  src.connect(lp).connect(v.gain);
  src.start();
  v.nodes = [src, lp];
  return v;
}

function createFire(audio, dest) {
  const v = new Voice(audio, dest);
  const src = audio.createBufferSource();
  src.buffer = whiteNoiseBuffer(audio, 2);
  src.loop = true;
  const hp = audio.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  // Spike gain at random intervals for crackle.
  const spikeGain = audio.createGain();
  spikeGain.gain.value = 0.5;
  src.connect(hp).connect(spikeGain).connect(v.gain);
  src.start();
  const schedule = () => {
    const now = audio.currentTime;
    const peak = 0.8 + Math.random() * 0.6;
    spikeGain.gain.cancelScheduledValues(now);
    spikeGain.gain.setValueAtTime(0.4, now);
    spikeGain.gain.linearRampToValueAtTime(peak, now + 0.02);
    spikeGain.gain.exponentialRampToValueAtTime(0.4, now + 0.12);
    const next = 80 + Math.random() * 400;
    v.timeouts.push(setTimeout(schedule, next));
  };
  schedule();
  v.nodes = [src, hp, spikeGain];
  return v;
}

function createDrip(audio, dest) {
  const v = new Voice(audio, dest);
  // No background source; we trigger discrete drips on a timer.
  const drip = () => {
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = 900 + Math.random() * 600;
    osc.frequency.setValueAtTime(osc.frequency.value, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.6, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(env).connect(v.gain);
    osc.start(now);
    osc.stop(now + 0.2);
    const next = 1800 + Math.random() * 5000;
    v.timeouts.push(setTimeout(drip, next));
  };
  // First drip after a short delay so enabling feels responsive.
  v.timeouts.push(setTimeout(drip, 300));
  return v;
}

function createScreams(audio, dest) {
  const v = new Voice(audio, dest);
  const scream = () => {
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 4;
    const env = audio.createGain();
    env.gain.value = 0;
    const duration = 0.6 + Math.random() * 1.2;
    const startPitch = 180 + Math.random() * 120;
    const endPitch = startPitch + 80 + Math.random() * 160;
    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(endPitch, now + duration);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.2);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(filter).connect(env).connect(v.gain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    const next = 8000 + Math.random() * 18000;
    v.timeouts.push(setTimeout(scream, next));
  };
  v.timeouts.push(setTimeout(scream, 2000));
  return v;
}

const CHANNEL_FACTORIES = {
  wind: createWind,
  rain: createRain,
  fire: createFire,
  drip: createDrip,
  screams: createScreams,
};

export const CHANNEL_LABELS = {
  wind: 'Wind',
  rain: 'Rain',
  fire: 'Fire crackle',
  drip: 'Cave drip',
  screams: 'Distant screams',
};

export function ensureContext() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume();
  return c;
}

export function setChannelLevel(id, level) {
  const audio = ensureContext();
  if (!audio) return;
  if (level <= 0) {
    const v = voices.get(id);
    if (v) {
      v.setLevel(0);
      // Give the fade time to land before tearing down.
      setTimeout(() => {
        v.destroy();
        voices.delete(id);
      }, 250);
    }
    return;
  }
  let v = voices.get(id);
  if (!v) {
    const factory = CHANNEL_FACTORIES[id];
    if (!factory) return;
    v = factory(audio, audio.destination);
    voices.set(id, v);
  }
  v.setLevel(level);
}

export function stopAll() {
  for (const [, v] of voices) v.destroy();
  voices.clear();
}

export function listChannels() {
  return Object.keys(CHANNEL_FACTORIES);
}
