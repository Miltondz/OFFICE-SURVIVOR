// src/systems/AudioManager.ts
import { AUDIO } from '@/config/game.config';

type AudioCategory = 'music' | 'sfx' | 'ui';

export class AudioManager {
  private static instance: AudioManager;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  private ctx: AudioContext | null = null;
  private volumes: Record<AudioCategory, number> = { ...AUDIO.DEFAULTS };

  /** Call on first user gesture to create / resume AudioContext. */
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    } else if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setVolume(cat: AudioCategory, v: number): void {
    this.volumes[cat] = Math.max(0, Math.min(1, v));
  }

  getVolume(cat: AudioCategory): number {
    return this.volumes[cat];
  }

  playBeep(key: keyof typeof AUDIO.BEEPS, cat: AudioCategory): void {
    if (!this.ctx) return;
    const { freq, ms } = AUDIO.BEEPS[key];
    const vol = this.volumes[cat];
    if (vol <= 0) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + ms);

    osc.start(now);
    osc.stop(now + ms);
  }
}
