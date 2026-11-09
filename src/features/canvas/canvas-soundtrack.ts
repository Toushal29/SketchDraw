export type SoundtrackConfig = {
  enabled: boolean;
  volume: number;
  style: "ambient" | "tonal" | "percussive";
};

const STORAGE_KEY = "sketchdraw-soundtrack";

export function readSoundtrackConfig(): SoundtrackConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, volume: 0.15, style: "ambient" };
  } catch { return { enabled: false, volume: 0.15, style: "ambient" }; }
}

export function writeSoundtrackConfig(config: SoundtrackConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ok */ }
}

let audioCtx: AudioContext | undefined;
let masterGain: GainNode | undefined;
let activeOscillators: OscillatorNode[] = [];

function ensureContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = readSoundtrackConfig().volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function getGain(): GainNode {
  ensureContext();
  return masterGain!;
}

const SCALE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];

function frequencyFromPosition(x: number, canvasWidth: number): number {
  const normalized = Math.max(0, Math.min(1, x / Math.max(1, canvasWidth)));
  const index = Math.floor(normalized * (SCALE.length - 1));
  return SCALE[index];
}

export function playStrokeSound(x: number, y: number, pressure: number, canvasWidth: number, canvasHeight: number) {
  const config = readSoundtrackConfig();
  if (!config.enabled) return;

  const ctx = ensureContext();
  const gain = getGain();
  gain.gain.value = config.volume;

  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();

  const freq = frequencyFromPosition(x, canvasWidth);
  const detune = ((y / Math.max(1, canvasHeight)) - 0.5) * 200;

  if (config.style === "ambient") {
    osc.type = "sine";
    osc.frequency.value = freq * 0.5;
    osc.detune.value = detune;
    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.linearRampToValueAtTime(pressure * 0.12, ctx.currentTime + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  } else if (config.style === "tonal") {
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.linearRampToValueAtTime(pressure * 0.15, ctx.currentTime + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  } else {
    osc.type = "square";
    osc.frequency.value = freq * 2;
    oscGain.gain.setValueAtTime(pressure * 0.06, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  }

  osc.connect(oscGain);
  oscGain.connect(gain);
  osc.start();
  osc.stop(ctx.currentTime + 1);
  osc.onended = () => { activeOscillators = activeOscillators.filter(o => o !== osc); };
  activeOscillators.push(osc);
}

export function playEraseSound() {
  const config = readSoundtrackConfig();
  if (!config.enabled) return;

  const ctx = ensureContext();
  const gain = getGain();
  gain.gain.value = config.volume;

  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.04;
  source.connect(noiseGain);
  noiseGain.connect(gain);
  source.start();
}

export function stopAllSounds() {
  for (const osc of activeOscillators) { try { osc.stop(); } catch { /* ok */ } }
  activeOscillators = [];
}

export function disposeSoundtrack() {
  stopAllSounds();
  if (audioCtx && audioCtx.state !== "closed") { audioCtx.close(); }
  audioCtx = undefined;
  masterGain = undefined;
}
