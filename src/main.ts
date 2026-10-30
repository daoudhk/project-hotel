import Phaser from 'phaser';
import '@fontsource/bungee/400.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/600.css';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { App } from './ui/app';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#050507',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
  fps: { target: 60 },
  audio: { disableWebAudio: false },
  scene: [BootScene, GameScene],
});

game.events.once('boot-complete', () => {
  const app = new App(game);
  app.showMenu();
  const boot = document.getElementById('boot');
  setTimeout(() => {
    boot?.classList.add('fade');
    setTimeout(() => boot?.remove(), 900);
  }, 350);
  (window as any).__hotel = { game, app };
});
