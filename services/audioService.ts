import { SoundEffectType } from '../types';

// ── Real MP3 assets ─────────────────────────────────────────────────────────
// Files served from /sounds (cashly_assets/sounds via server.ts static route)
const audioCache = new Map<string, HTMLAudioElement>();

function playMp3(src: string, volume = 1.0) {
  try {
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audioCache.set(src, audio);
    }
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.play().catch(() => {/* autoplay policy — silently ignore */});
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

// ── Synth fallback via Web Audio API ────────────────────────────────────────
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const getCtx = () => {
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
      case 'land':
        createOsc(ctx, 'sine', 400, now, 0.1, 0.05);
        break;
      case 'win':
        [300, 400, 500, 600, 800].forEach((f, i) => createOsc(ctx, 'triangle', f, now + i * 0.15, 0.5, 0.1));
        break;
      case 'trade':
        createOsc(ctx, 'sine', 600, now, 0.1, 0.05);
        createOsc(ctx, 'sine', 800, now + 0.1, 0.2, 0.05);
        break;
      case 'bid':
        createOsc(ctx, 'sine', 550, now, 0.1, 0.05);
        createOsc(ctx, 'sine', 700, now + 0.05, 0.1, 0.05);
        break;
      case 'ui_click':
        createOsc(ctx, 'sine', 800, now, 0.05, 0.05);
        break;
      case 'ui_hover':
        createOsc(ctx, 'sine', 1200, now, 0.03, 0.01);
        break;
      case 'modal_open': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'modal_close': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'trade_offer':
        createOsc(ctx, 'sine', 500, now, 0.1, 0.05);
        createOsc(ctx, 'sine', 750, now + 0.1, 0.2, 0.05);
        break;
      case 'notification':
        createOsc(ctx, 'sine', 880, now, 0.3, 0.05);
        break;
      case 'error':
        createOsc(ctx, 'sawtooth', 150, now, 0.15, 0.08);
        break;
      case 'player_join':
        createOsc(ctx, 'sine', 440, now, 0.1, 0.07);
        createOsc(ctx, 'sine', 660, now + 0.1, 0.2, 0.07);
        break;
      case 'player_leave':
        createOsc(ctx, 'sine', 550, now, 0.1, 0.06);
        createOsc(ctx, 'sine', 330, now + 0.1, 0.25, 0.06);
        break;
      case 'monopoly':
        // Triumphant ascending fanfare
        [400, 500, 600, 800, 1000, 1200].forEach((f, i) =>
          createOsc(ctx, 'triangle', f, now + i * 0.1, 0.55, 0.12)
        );
        createOsc(ctx, 'sine', 1200, now + 0.6, 0.6, 0.1);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('Audio synth failed', e);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export const playSound = (effect: SoundEffectType) => {
  switch (effect) {
    // Real MP3 assets
    case 'roll':
      // Use bundled kenney dice OGG (cashly_assets/sounds may not exist in all envs)
      playMp3('/assets/images/kenney_boardgame-pack/Bonus/dieThrow1.ogg', 0.75);
      break;
    case 'trade_accept':
      playSynth('trade');
      break;
    case 'trade_decline':
      playSynth('error');
      break;
    case 'notification':
      playSynth('notification');
      break;
    case 'win':
      playSynth('win');
      break;

    // Synth fallbacks for everything else
    default:
      playSynth(effect);
      break;
  }
};
