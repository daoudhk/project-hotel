import Phaser from 'phaser';
import { settings } from '../progression/settings';

export const SOUND_KEYS = [
  'shot_pistol', 'shot_mp5', 'shot_m4', 'shot_deagle', 'mag_out', 'mag_in', 'slide_rack', 'dry_fire', 'weapon_swap',
  'step_carpet_0', 'step_carpet_1', 'step_carpet_2', 'step_tile_0', 'step_tile_1',
  'impact_wall', 'impact_flesh', 'impact_wood', 'impact_armor', 'body_fall', 'hurt',
  'flashlight', 'pickup_ammo', 'pickup_weapon', 'coin', 'armor', 'pickup_plate', 'hostage_free',
  'alert', 'suspicious', 'mission_complete', 'mission_fail', 'objective', 'ui_hover', 'ui_click', 'upgrade', 'ambience',
] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

export function preloadAudio(scene: Phaser.Scene) {
  for (const k of SOUND_KEYS) scene.load.audio(k, `audio/${k}.wav`);
}

/** Spatial sound playback relative to a listener, with master / sfx / ambience volume channels. */
export class AudioManager {
  private listener = { x: 0, y: 0 };
  private ambience?: Phaser.Sound.BaseSound;
  private lastPlay = new Map<string, number>();

  constructor(private scene: Phaser.Scene) {}

  setListener(x: number, y: number) {
    this.listener.x = x;
    this.listener.y = y;
  }

  /** Play a sound; if x/y are given it is attenuated and panned relative to the listener. */
  play(key: SoundKey, opts: { x?: number; y?: number; volume?: number; range?: number; detune?: number; rate?: number; throttle?: number } = {}) {
    const s = settings.get();
    let vol = (opts.volume ?? 1) * s.master * s.sfx;
    let pan = 0;
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.listener.x, dy = opts.y - this.listener.y;
      const d = Math.hypot(dx, dy);
      const range = opts.range ?? 900;
      if (d > range) return;
      const att = 1 - d / range;
      vol *= att * att;
      pan = Math.max(-1, Math.min(1, dx / 600)) * 0.7;
    }
    if (vol < 0.01) return;
    if (opts.throttle) {
      const now = this.scene.time.now;
      if (now - (this.lastPlay.get(key) ?? -1e9) < opts.throttle) return;
      this.lastPlay.set(key, now);
    }
    try {
      this.scene.sound.play(key, { volume: vol, pan, detune: opts.detune ?? 0, rate: opts.rate ?? 1 } as Phaser.Types.Sound.SoundConfig);
    } catch {
      /* audio not unlocked yet */
    }
  }

  ui(key: SoundKey, volume = 1) {
    const s = settings.get();
    try {
      this.scene.sound.play(key, { volume: volume * s.master * s.ui });
    } catch { /* noop */ }
  }

  startAmbience() {
    const s = settings.get();
    if (!this.ambience) {
      this.ambience = this.scene.sound.add('ambience', { loop: true, volume: s.master * s.ambience * 0.8 });
      try { this.ambience.play(); } catch { /* locked */ }
    }
    this.refreshVolumes();
  }

  refreshVolumes() {
    const s = settings.get();
    if (this.ambience) (this.ambience as Phaser.Sound.WebAudioSound).setVolume?.(s.master * s.ambience * 0.8);
  }

  stopAmbience() {
    this.ambience?.stop();
    this.ambience?.destroy();
    this.ambience = undefined;
  }
}
