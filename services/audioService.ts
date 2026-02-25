
// Simple synth-based audio service to avoid external asset dependencies
import { SoundEffectType } from '../types';

const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const getCtx = () => {
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }
    return audioCtx;
}

export const playSound = (effect: SoundEffectType) => {
    try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;

        const createOsc = (type: OscillatorType, freq: number, start: number, dur: number, vol: number = 0.1) => {
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
            return { osc, gain };
        };

        switch (effect) {
            case 'roll':
                for(let i=0; i<6; i++) {
                   createOsc('square', 100 + Math.random() * 50, now + i*0.06, 0.05, 0.03);
                }
                break;
            case 'buy':
                createOsc('sine', 800, now, 0.15, 0.1);
                createOsc('sine', 1200, now + 0.1, 0.4, 0.1);
                break;
            case 'pay':
                createOsc('triangle', 300, now, 0.1, 0.1);
                createOsc('triangle', 200, now + 0.1, 0.2, 0.1);
                break;
            case 'upgrade':
                createOsc('square', 150, now, 0.1, 0.15);
                createOsc('square', 150, now + 0.15, 0.2, 0.15);
                break;
            case 'turn_switch':
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
            case 'land':
                 createOsc('sine', 400, now, 0.1, 0.05);
                 break;
            case 'win':
                 [300, 400, 500, 600, 800].forEach((f, i) => createOsc('triangle', f, now + i*0.15, 0.5, 0.1));
                 break;
            case 'trade':
                 createOsc('sine', 600, now, 0.1, 0.05);
                 createOsc('sine', 800, now + 0.1, 0.2, 0.05);
                 break;
            case 'bid':
                 createOsc('sine', 550, now, 0.1, 0.05);
                 createOsc('sine', 700, now + 0.05, 0.1, 0.05);
                 break;
            case 'ui_click':
                 createOsc('sine', 800, now, 0.05, 0.05);
                 break;
            case 'ui_hover':
                 createOsc('sine', 1200, now, 0.03, 0.01);
                 break;
            case 'modal_open':
                 // Slide up
                 const oscOpen = ctx.createOscillator();
                 const gainOpen = ctx.createGain();
                 oscOpen.connect(gainOpen);
                 gainOpen.connect(ctx.destination);
                 oscOpen.frequency.setValueAtTime(400, now);
                 oscOpen.frequency.exponentialRampToValueAtTime(600, now + 0.2);
                 gainOpen.gain.setValueAtTime(0.05, now);
                 gainOpen.gain.linearRampToValueAtTime(0, now + 0.2);
                 oscOpen.start(now);
                 oscOpen.stop(now + 0.2);
                 break;
            case 'modal_close':
                 // Slide down
                 const oscClose = ctx.createOscillator();
                 const gainClose = ctx.createGain();
                 oscClose.connect(gainClose);
                 gainClose.connect(ctx.destination);
                 oscClose.frequency.setValueAtTime(600, now);
                 oscClose.frequency.exponentialRampToValueAtTime(400, now + 0.2);
                 gainClose.gain.setValueAtTime(0.05, now);
                 gainClose.gain.linearRampToValueAtTime(0, now + 0.2);
                 oscClose.start(now);
                 oscClose.stop(now + 0.2);
                 break;
            case 'trade_offer':
                 createOsc('sine', 500, now, 0.1, 0.05);
                 createOsc('sine', 750, now + 0.1, 0.2, 0.05);
                 break;
            case 'trade_accept':
                 // Major triad
                 createOsc('triangle', 523.25, now, 0.1, 0.05); // C5
                 createOsc('triangle', 659.25, now + 0.05, 0.1, 0.05); // E5
                 createOsc('triangle', 783.99, now + 0.1, 0.2, 0.05); // G5
                 break;
            case 'trade_decline':
                 createOsc('sawtooth', 400, now, 0.15, 0.05);
                 createOsc('sawtooth', 300, now + 0.15, 0.2, 0.05);
                 break;
            case 'notification':
                 createOsc('sine', 880, now, 0.3, 0.05);
                 break;
            case 'error':
                 createOsc('sawtooth', 150, now, 0.15, 0.08);
                 break;
            default:
                break;
        }
    } catch (e) {
        console.error("Audio play failed", e);
    }
};
