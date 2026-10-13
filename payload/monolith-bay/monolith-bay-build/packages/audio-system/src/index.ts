// @monolith/audio-system
// Audio bus system: music, sfx, voice, ambience with volume controls.

export type AudioBus = "master" | "music" | "sfx" | "voice" | "ambience";

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambienceVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  voiceVolume: 1.0,
  ambienceVolume: 0.5,
  muted: false,
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private buses = new Map<AudioBus, GainNode>();
  private settings: AudioSettings;
  private buffers = new Map<string, AudioBuffer>();

  constructor(settings: Partial<AudioSettings> = {}) {
    this.settings = { ...DEFAULT_AUDIO_SETTINGS, ...settings };
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = this.settings.masterVolume;
      master.connect(this.ctx.destination);
      this.buses.set("master", master);
      for (const bus of ["music", "sfx", "voice", "ambience"] as AudioBus[]) {
        const gain = this.ctx.createGain();
        gain.gain.value = this.settings[`${bus}Volume` as keyof AudioSettings] as number;
        gain.connect(master);
        this.buses.set(bus, gain);
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  async loadBuffer(name: string, url: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(name, buffer);
  }

  play(name: string, bus: AudioBus = "sfx"): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(name);
    const gain = this.buses.get(bus);
    if (!ctx || !buffer || !gain || this.settings.muted) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  }

  setVolume(bus: AudioBus, volume: number) {
    this.settings[`${bus}Volume` as keyof AudioSettings] = volume as never;
    const gain = this.buses.get(bus);
    if (gain) gain.gain.value = volume;
  }

  setMuted(muted: boolean) {
    this.settings.muted = muted;
    const master = this.buses.get("master");
    if (master) master.gain.value = muted ? 0 : this.settings.masterVolume;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }
}
