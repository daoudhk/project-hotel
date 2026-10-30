import Phaser from 'phaser';
import { uiBus } from '../core/emitter';
import type { GameScene } from '../scenes/GameScene';
import { settings } from '../progression/settings';
import { profile } from '../progression/profile';
import { DIFFICULTIES, Difficulty } from '../data/difficulty';
import { Hud } from './hud';
import { MainMenu, settingsRows } from './menu';
import { h } from './dom';
import { TEAM_NAMES } from '../sim/types';

type Mode = 'menu' | 'match';

/** Owns the HTML interface and switches the game scene between menu backdrop and live matches. */
export class App {
  private root = document.getElementById('ui')!;
  private menu: MainMenu;
  private hud: Hud | null = null;
  private overlay: HTMLElement | null = null;
  private scoreboardEl: HTMLElement | null = null;
  private mode: Mode = 'menu';
  private scene: GameScene | null = null;
  private lastDeploy: { team: 'AT' | 'GUARD'; difficulty: Difficulty; allies: number } | null = null;

  constructor(private game: Phaser.Game) {
    this.menu = new MainMenu({ deploy: (c) => this.deploy(c), sound: (k) => this.uiSound(k) });
    this.root.append(this.menu.el);
    uiBus.on('scene-ready', (s: GameScene) => {
      this.scene = s;
      if (this.hud) s.hud = this.hud;
    });
    uiBus.on('match-ended', (r: any) => this.showResults(r));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { if (this.mode === 'match' && !this.overlay && !this.scene?.world.match.winner) this.pause(); });
    // arcade feel: every button pops when pressed, .tilt cards lean towards the cursor
    this.root.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest('button, .row, .stat') as HTMLElement | null;
      if (!b || b.matches(':disabled')) return;
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      setTimeout(() => b.classList.remove('pop'), 340);
    });
    this.root.addEventListener('mousemove', (e) => {
      const card = (e.target as HTMLElement).closest('.tilt') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${x * 10}deg`);
      card.style.setProperty('--rx', `${-y * 10}deg`);
    });
    this.root.addEventListener('mouseout', (e) => {
      const card = (e.target as HTMLElement).closest('.tilt') as HTMLElement | null;
      if (card && !card.contains(e.relatedTarget as Node)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
    });
    // browsers need a gesture before audio can play
    const unlock = () => { (this.game.sound as any).context?.resume?.(); this.scene?.audio.startAmbience(); };
    window.addEventListener('pointerdown', unlock, { once: false });
  }

  uiSound(k: 'ui_hover' | 'ui_click' | 'upgrade') {
    this.scene?.audio.ui(k, k === 'ui_hover' ? 0.5 : 1);
  }

  showMenu() {
    this.mode = 'menu';
    this.closeOverlay();
    this.hud?.el.remove();
    this.hud = null;
    this.menu.show();
    this.game.scene.start('game', { mode: 'attract' });
  }

  deploy(c: { team: 'AT' | 'GUARD'; difficulty: Difficulty; allies: number }) {
    this.lastDeploy = c;
    this.mode = 'match';
    this.menu.hide();
    this.closeOverlay();
    this.hud?.el.remove();
    this.hud = new Hud(() => this.leaveMatch());
    this.root.append(this.hud.el);
    this.hud.showBriefing(c.team, DIFFICULTIES[c.difficulty].label);
    this.game.scene.start('game', {
      mode: 'match',
      config: { playerTeam: c.team, difficulty: c.difficulty, allies: c.allies, seed: Math.floor(Math.random() * 1e9), hostages: 3, timeLimit: 480, playerName: profile.get().callsign },
    });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (this.mode === 'match' && !this.overlay) this.toggleScoreboard(down);
      return;
    }
    if (!down) return;
    if (e.key === 'F3') {
      e.preventDefault();
      settings.set({ showFps: !settings.get().showFps });
      return;
    }
    if (e.key === 'Escape') {
      if (this.mode !== 'match') return;
      if (this.overlay?.dataset.kind === 'pause') this.resume();
      else if (!this.overlay) this.pause();
    }
  }

  private toggleScoreboard(show: boolean) {
    this.scoreboardEl?.remove();
    this.scoreboardEl = null;
    if (show && this.scene && this.hud) {
      this.scoreboardEl = this.hud.scoreboard(this.scene.world, this.scene.local());
      this.root.append(this.scoreboardEl);
    }
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  pause() {
    if (!this.scene || this.overlay) return;
    this.scene.setPaused(true);
    this.scene.input.setDefaultCursor('default');
    const box = h('div.ov-box');
    const render = () => {
      box.innerHTML = '';
      box.append(h('div.label', null, 'Operation paused'), h('h2', null, 'Paused'),
        h('div.ov-actions', null,
          h('button.btn.primary', { onclick: () => this.resume() }, 'Resume'),
          h('button.btn', { onclick: () => { this.uiSound('ui_click'); renderSettings(); } }, 'Settings'),
          h('button.btn.danger', { onclick: () => { this.uiSound('ui_click'); this.leaveMatch(); } }, 'Abandon operation')),
        h('div.label', { style: { marginTop: '20px', textTransform: 'none', letterSpacing: '0.06em' } }, 'Abandoning does not record the match or award coins.'));
    };
    const renderSettings = () => {
      box.innerHTML = '';
      box.append(h('div.label', null, 'Options'), h('h2', null, 'Settings'), ...settingsRows(renderSettings, (k) => this.uiSound(k)),
        h('div.ov-actions.row-actions', null, h('button.btn', { onclick: () => { this.uiSound('ui_click'); render(); } }, 'Back')));
    };
    render();
    this.overlay = h('div.overlay', { 'data-kind': 'pause' }, box);
    this.root.append(this.overlay);
  }

  resume() {
    if (this.overlay?.dataset.kind !== 'pause') return;
    this.closeOverlay();
    this.scene?.setPaused(false);
    this.scene?.input.setDefaultCursor('none');
  }

  private leaveMatch() {
    this.scene?.setPaused(false);
    this.showMenu();
  }

  private showResults(r: { won: boolean; reason: string; rewards: any; stats: any; time: number; team: 'AT' | 'GUARD'; difficulty: Difficulty }) {
    if (this.mode !== 'match') return;
    this.closeOverlay();
    this.toggleScoreboard(false);
    this.scene?.input.setDefaultCursor('default');
    const s = r.stats;
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    const mins = Math.floor(r.time / 60), secs = Math.floor(r.time % 60);
    const stat = (label: string, v: string) => h('div', null, h('div.label', null, label), h('div.v', null, v));
    const rewards = h('div.rewards');
    const rows: [string, number][] = [['Coins collected', r.rewards.coinsCollected]];
    if (r.rewards.missionBonus) rows.push(['Mission complete', r.rewards.missionBonus]);
    for (const c of r.rewards.contracts) rows.push([`Contract · ${c.name}`, c.reward]);
    rows.forEach(([l, v], i) => { const row = h('div.rr', null, h('span', null, l), h('span.v', null, `+${v}`)); row.style.animationDelay = `${0.3 + i * 0.15}s`; rewards.append(row); });
    const totalV = h('span.v', null, '0');
    rewards.append(h('div.total', null, h('span', null, 'Total earned'), totalV));
    let n = 0;
    const target = r.rewards.total;
    const iv = setInterval(() => { n = Math.min(target, n + Math.max(1, Math.ceil(target / 30))); totalV.textContent = `+${n}`; if (n >= target) clearInterval(iv); }, 40);
    const box = h('div.ov-box.wide', null,
      h('div.label', null, `${TEAM_NAMES[r.team]} · ${DIFFICULTIES[r.difficulty].label} · ${mins}:${String(secs).padStart(2, '0')}`),
      h(`div.result-title.${r.won ? 'win' : 'loss'}`, null, r.won ? 'Mission complete' : 'Mission failed'),
      h('div.result-reason', null, r.reason),
      h('div.result-grid', null, stat('Eliminations', String(s.kills)), stat('Accuracy', `${acc}%`), stat('Hostages freed', String(s.rescues)), stat('Time hidden', `${Math.floor(s.hiddenTime)}s`)),
      rewards,
      h('div.label', { style: { marginTop: '14px', textTransform: 'none', letterSpacing: '0.05em' } }, `Balance: ${profile.get().coins} coins — spend them in Skills.`),
      h('div.ov-actions.row-actions', null,
        h('button.btn', { onclick: () => { this.uiSound('ui_click'); this.showMenu(); } }, 'Main menu'),
        h('button.btn.primary', { onclick: () => { this.uiSound('ui_click'); if (this.lastDeploy) this.deploy(this.lastDeploy); } }, 'Redeploy')));
    this.overlay = h('div.overlay', { 'data-kind': 'results' }, box);
    this.root.append(this.overlay);
  }
}
