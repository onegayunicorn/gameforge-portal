export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambienceVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  voiceVolume: 1.0,
  ambienceVolume: 0.5,
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;

  constructor(settings: Partial<AudioSettings> = {}) {
    this.settings = { ...DEFAULT_AUDIO_SETTINGS, ...settings };
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playSfx(_bufferName: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Placeholder: load and play buffer with sfxVolume * masterVolume
  }

  setSettings(settings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...settings };
  }
}
