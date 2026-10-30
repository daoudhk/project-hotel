import Phaser from 'phaser';
import { preloadAudio } from '../audio/audio';
import { generateTextures } from '../render/textures';

/** Loads local audio, waits for bundled fonts and generates every procedural texture. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const bar = document.getElementById('boot-progress');
    const status = document.getElementById('boot-status');
    this.load.on('progress', (p: number) => {
      if (bar) bar.style.width = `${Math.round(p * 70)}%`;
      const pct = document.getElementById('boot-pct');
      if (pct) pct.textContent = `${Math.round(p * 70)}%`;
    });
    if (status) status.textContent = 'Loading sound…';
    preloadAudio(this);
  }

  async create() {
    const bar = document.getElementById('boot-progress');
    const status = document.getElementById('boot-status');
    if (status) status.textContent = 'Dressing the rooms…';
    try {
      await Promise.all([
        document.fonts.load('600 16px "Barlow Condensed"'),
        document.fonts.load('400 16px "Bungee"'),
        document.fonts.load('700 16px "Rubik"'),
      ]);
    } catch { /* fall back to system fonts */ }
    await new Promise((r) => setTimeout(r, 30));
    generateTextures(this);
    if (bar) bar.style.width = '100%';
    const pct = document.getElementById('boot-pct');
    if (pct) pct.textContent = '100%';
    if (status) status.textContent = 'Ready!';
    this.game.events.emit('boot-complete');
  }
}
