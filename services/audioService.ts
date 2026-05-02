import { SoundEffectType } from '../types';

type AudioCue = {
  src: string;
  volume: number;
  fallback?: SoundEffectType;
};

const sound = (file: string) => `/sounds/${file}`;

const REAL_AUDIO: Record<SoundEffectType, AudioCue> = {
  roll:          { src: sound('dice.mp3'), volume: 0.75 },
  buy:           { src: sound('_definite.mp3'), volume: 0.5 },
  pay:           { src: sound('_hollow_pitched_down.mp3'), volume: 0.5 },
  upgrade:       { src: sound('_arpeggio.mp3'), volume: 0.55 },
  turn_switch:   { src: sound('_appointed.mp3'), volume: 0.36 },
  win:           { src: sound('game-start.mp3'), volume: 0.72 },
  land:          { src: sound('_hollow.mp3'), volume: 0.28 },
  trade:         { src: sound('_case-closed.mp3'), volume: 0.52 },
  bid:           { src: sound('_definite_pitched_down.mp3'), volume: 0.44 },
  ui_click:      { src: sound('_appointed.mp3'), volume: 0.24 },
  ui_hover:      { src: sound('_hollow_pitched_down.mp3'), volume: 0.12 },
  modal_open:    { src: sound('_beyond-doubt-2.mp3'), volume: 0.28 },
  modal_close:   { src: sound('_hollow_pitched_down.mp3'), volume: 0.22 },
  trade_offer:   { src: sound('chat-out.mp3'), volume: 0.46 },
  trade_accept:  { src: sound('trade-accept.mp3'), volume: 0.8 },
  trade_decline: { src: sound('trade-decline.mp3'), volume: 0.8 },
  notification:  { src: sound('chat-in.mp3'), volume: 0.65 },
  error:         { src: sound('_case-closed.mp3'), volume: 0.42 },
  player_join:   { src: sound('game-start.mp3'), volume: 0.55 },
  player_leave:  { src: sound('_hollow_pitched_down.mp3'), volume: 0.38 },
  monopoly:      { src: sound('_beyond-doubt-2.mp3'), volume: 0.68, fallback: 'win' },
};

const POOL_SIZE = 4;
const audioPools = new Map<string, HTMLAudioElement[]>();
let unlocked = false;

const getAudioPool = (src: string) => {
  let pool = audioPools.get(src);
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      return audio;
    });
    audioPools.set(src, pool);
  }
  return pool;
};

const pickAudio = (src: string) => {
  const pool = getAudioPool(src);
  return pool.find(audio => audio.paused || audio.ended) ?? pool[0];
};

const playAsset = async ({ src, volume }: AudioCue) => {
  const audio = pickAudio(src);
  audio.currentTime = 0;
  audio.volume = Math.min(1, Math.max(0, volume));
  await audio.play();
};

const AudioContextClass =
  typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null;
let audioCtx: AudioContext | null = null;

const getCtx = () => {
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
};

const createOsc = (
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  vol = 0.1
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
};

function playSynth(effect: SoundEffectType) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    switch (effect) {
      case 'buy':
        createOsc(ctx, 'sine', 800, now, 0.15, 0.1);
        createOsc(ctx, 'sine', 1200, now + 0.1, 0.4, 0.1);
        break;
      case 'pay':
        createOsc(ctx, 'triangle', 300, now, 0.1, 0.1);
        createOsc(ctx, 'triangle', 200, now + 0.1, 0.2, 0.1);
        break;
      case 'upgrade':
        createOsc(ctx, 'square', 150, now, 0.1, 0.15);
        createOsc(ctx, 'square', 150, now + 0.15, 0.2, 0.15);
        break;
      case 'turn_switch': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case 'win':
      case 'monopoly':
        [300, 400, 500, 600, 800].forEach((f, i) => createOsc(ctx, 'triangle', f, now + i * 0.15, 0.5, 0.1));
        break;
      case 'trade':
      case 'trade_offer':
        createOsc(ctx, 'sine', 600, now, 0.1, 0.05);
        createOsc(ctx, 'sine', 800, now + 0.1, 0.2, 0.05);
        break;
      case 'bid':
        createOsc(ctx, 'sine', 550, now, 0.1, 0.05);
        createOsc(ctx, 'sine', 700, now + 0.05, 0.1, 0.05);
        break;
      case 'error':
        createOsc(ctx, 'sawtooth', 150, now, 0.15, 0.08);
        break;
      case 'player_leave':
        createOsc(ctx, 'sine', 550, now, 0.1, 0.06);
        createOsc(ctx, 'sine', 330, now + 0.1, 0.25, 0.06);
        break;
      default:
        createOsc(ctx, 'sine', 700, now, 0.08, 0.04);
        break;
    }
  } catch {
    // Audio is decorative; never let it break gameplay.
  }
}

export const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;
  getCtx()?.resume().catch(() => {});
  Object.values(REAL_AUDIO).forEach(cue => {
    getAudioPool(cue.src).forEach(audio => {
      audio.load();
    });
  });
};

export const playSound = (effect: SoundEffectType) => {
  unlockAudio();
  const cue = REAL_AUDIO[effect];
  playAsset(cue).catch(() => playSynth(cue.fallback ?? effect));
};
