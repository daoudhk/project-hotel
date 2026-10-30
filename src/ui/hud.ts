import { WEAPONS, WeaponId, CALIBERS } from '../data/weapons';
import type { World } from '../sim/world';
import type { Actor } from '../sim/types';
import { TEAM_NAMES } from '../sim/types';
import { settings } from '../progression/settings';
import { weaponIcon } from '../render/textures';
import { h, ICONS, setText } from './dom';

const iconCache = new Map<WeaponId, string>();
const icon = (w: WeaponId) => {
  if (!iconCache.has(w)) iconCache.set(w, weaponIcon(w, 200, 76));
  return iconCache.get(w)!;
};

/** Minimal in-game HUD rendered in HTML above the canvas. */
export class Hud {
  readonly el: HTMLElement;
  private objOp = h('div.obj-op');
  private objTitle = h('div.obj-title');
  private pips = h('div.obj-pips');
  private enemies = h('span');
  private timer = h('div.timer');
  private loc = h('div.loc');
  private coins = h('div.coins');
  private killfeedEl = h('div.killfeed');
  private hpFill = h('div.fill'); private hpLag = h('div.lag'); private hpNum = h('div.num'); private hpBar = h('div.vbar.hp', null, this.hpLag, this.hpFill);
  private arFill = h('div.fill'); private arLag = h('div.lag'); private arNum = h('div.num');
  private platesEl = h('div.plates');
  private stealthEl = h('div.stealth');
  private stealthText = h('span');
  private stealthMeter = h('span');
  private stealthEye = h('span.eye');
  private wname = h('div.wname'); private wcal = h('div.wcal'); private wimg = h('img.wimg') as HTMLImageElement;
  private mag = h('span.mag'); private res = h('span.res');
  private slots = h('div.slots');
  private reloading = h('div.reloading');
  private promptEl = h('div.prompt.hidden');
  private promptText = h('span');
  private promptBar = h('div.pbar');
  private noticesEl = h('div.notices');
  private vignette = h('div.vignette');
  private hiddenVig = h('div.hidden-vig');
  private dmgdir = h('div.dmgdir');
  private hit = h('div.hitmarker');
  private detectedEl = h('div.detected', null, 'Detected');
  private fpsEl = h('div.fps.hidden');
  private brief = h('div.brief-card');
  private spectateEl = h('div.spectate.hidden');
  private lastW = '';
  private tick = 0;
  private lastSlots = '';
  private lastPlates = '';
  private lastPips = '';

  constructor(private onLeave: () => void) {
    this.el = h('div#hud',
      null,
      this.vignette, this.hiddenVig, this.dmgdir, this.hit,
      h('div.hud-tl', null, this.objOp, this.objTitle, h('div.obj-row', null, this.pips, this.enemies), this.timer, this.loc),
      h('div.hud-tr', null, this.coins, this.killfeedEl),
      h('div.hud-bl', null,
        h('div.vital', null, h('div.ico', { html: ICONS.heart }), this.hpBar, this.hpNum),
        h('div.vital', null, h('div.ico', { html: ICONS.shield }), h('div.vbar.ar', null, this.arLag, this.arFill), this.arNum),
        this.platesEl,
        h('div', null, this.stealthEl)),
      h('div.hud-br', null, this.wname, this.wcal, this.wimg, h('div.ammo', null, this.mag, this.res), this.reloading, this.slots),
      this.promptEl, this.noticesEl, this.detectedEl, this.fpsEl, this.brief, this.spectateEl,
    );
    this.promptEl.append(this.promptText, this.promptBar);
    this.stealthEl.append(this.stealthEye, this.stealthText, h('div.meter', null, this.stealthMeter));
  }

  showBriefing(team: 'AT' | 'GUARD', difficulty: string) {
    this.brief.innerHTML = '';
    this.brief.append(h('div', null,
      h('div.op', null, `Operation Night Shift · ${difficulty}`),
      h('h2', null, team === 'AT' ? 'Find the hostages.' : 'Hold the hotel.'),
      h('p', null, team === 'AT' ? 'Three hostages are held somewhere on the ground floor. Bring them to the entrance.' : 'The strike team is coming for the hostages. Keep them here.'),
      h('div.count', null, 'Deploying')));
    this.brief.style.opacity = '1';
    this.brief.classList.remove('hidden');
  }

  fps(v: number, perf?: { sim: number; light: number; views: number }) {
    const show = settings.get().showFps;
    this.fpsEl.classList.toggle('hidden', !show);
    if (show) setText(this.fpsEl, `${v.toFixed(0)} FPS` + (perf ? ` · sim ${perf.sim.toFixed(1)}ms · views ${perf.views.toFixed(1)}ms · light ${perf.light.toFixed(1)}ms` : ''));
  }

  update(w: World, me: Actor | undefined, dt: number) {
    this.tick += dt;
    const m = w.match;
    if (m.phase === 'briefing') {
      this.brief.classList.remove('hidden');
    } else if (m.phase === 'live' && !this.brief.classList.contains('hidden') && this.brief.style.opacity !== '0') {
      this.brief.style.opacity = '0';
      setTimeout(() => this.brief.classList.add('hidden'), 800);
    }
    if (!me) return;
    // ---- objective
    const team = me.team;
    setText(this.objOp, `Operation Night Shift · ${TEAM_NAMES[team]}`);
    const following = w.hostages.filter((x) => x.state === 'following').length;
    const enemyAlive = w.actors.filter((a) => a.alive && a.team !== team).length;
    let title: string;
    if (team === 'AT') title = following > 0 ? 'Escort the hostage to the entrance' : m.hostagesRescued >= m.hostagesTotal ? 'All hostages safe' : 'Locate and free the hostages';
    else title = following > 0 ? 'A hostage is being taken — stop them' : 'Protect the hostages';
    setText(this.objTitle, title);
    const pipKey = w.hostages.map((x) => x.state).join();
    if (pipKey !== this.lastPips) {
      this.lastPips = pipKey;
      this.pips.innerHTML = '';
      for (const x of w.hostages) this.pips.append(h(`i${x.state === 'rescued' ? '.on' : x.state === 'following' ? '.follow' : ''}`));
    }
    setText(this.enemies, `${m.hostagesRescued}/${m.hostagesTotal} rescued · ${enemyAlive} hostile${enemyAlive === 1 ? '' : 's'}`);
    const t = Math.ceil(m.timeLeft);
    setText(this.timer, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.timer.classList.toggle('low', t <= 60 && m.phase === 'live');
    setText(this.loc, w.map.roomAt(me.x, me.y)?.name ?? '');
    setText(this.coins, '');
    if (!this.coins.firstChild || this.coins.dataset.v !== String(me.stats.coins)) {
      this.coins.dataset.v = String(me.stats.coins);
      this.coins.innerHTML = `<span class="coin-ico"></span>${me.stats.coins}`;
    }

    // ---- vitals
    const hp = Math.max(0, me.health), ar = Math.max(0, me.armor);
    this.hpFill.style.width = `${hp}%`; this.hpLag.style.width = `${hp}%`;
    this.arFill.style.width = `${ar}%`; this.arLag.style.width = `${ar}%`;
    setText(this.hpNum, String(Math.ceil(hp)));
    setText(this.arNum, String(Math.ceil(ar)));
    this.hpBar.classList.toggle('low', hp < 30 && me.alive);
    this.vignette.classList.toggle('lowhp', hp < 30 && me.alive);
    const plateKey = `${me.inv.plates}/${me.mods.plateCapacity}/${me.plateTimer > 0}`;
    if (plateKey !== this.lastPlates) {
      this.lastPlates = plateKey;
      this.platesEl.innerHTML = '';
      for (let i = 0; i < me.mods.plateCapacity; i++) this.platesEl.append(h(`i${i < me.inv.plates ? '.on' : ''}`));
      this.platesEl.append(h('span', { style: { marginLeft: '6px' } }, me.plateTimer > 0 ? 'Applying…' : me.inv.plates > 0 ? 'Q · Apply plate' : 'No plates'));
    }

    // ---- stealth indicator
    const threat = me.threat;
    let cls = '', label = 'Visible', eye = ICONS.eyeOpen, meter = 0;
    if (me.hidden) { cls = 'is-hidden'; label = 'Hidden'; eye = ICONS.eyeClosed; meter = 1; }
    else if (me.hideTimer > 0) { cls = 'is-hidden'; label = 'Hiding…'; eye = ICONS.eyeClosed; meter = Math.min(1, me.hideTimer); }
    if (threat >= 1) { cls = 'seen'; label = 'Detected'; eye = ICONS.eyeOpen; meter = 1; }
    else if (threat > 0.25) { cls = 'sus'; label = 'Suspicious'; eye = ICONS.eyeOpen; meter = threat; }
    else if (!me.hidden && me.hideTimer <= 0) { label = me.flashlight ? 'Visible · light on' : 'Visible'; meter = 0; }
    this.stealthEl.className = `stealth ${cls}`;
    setText(this.stealthText, label);
    if (this.stealthEye.dataset.k !== eye) { this.stealthEye.dataset.k = eye; this.stealthEye.innerHTML = eye; }
    this.stealthMeter.style.width = `${meter * 100}%`;
    this.hiddenVig.style.opacity = me.hidden ? '1' : '0';

    // ---- weapon
    const wi = me.inv.slots[me.inv.active];
    if (wi) {
      const def = WEAPONS[wi.def];
      if (this.lastW !== wi.def) { this.lastW = wi.def; this.wimg.src = icon(wi.def); setText(this.wname, def.name); setText(this.wcal, `${def.caliber} · ${def.automatic ? 'Automatic' : 'Semi-auto'}`); }
      setText(this.mag, String(wi.mag));
      this.mag.classList.toggle('low', wi.mag <= Math.ceil(def.magazine * 0.25));
      setText(this.res, String(me.inv.reserve[def.caliber]));
      setText(this.reloading, me.reloadTimer > 0 ? 'Reloading' : me.swapTimer > 0 ? 'Switching' : wi.mag === 0 && me.inv.reserve[def.caliber] > 0 ? 'Press R to reload' : wi.mag === 0 ? 'Find ammunition' : '');
    }
    const slotKey = me.inv.slots.map((s) => s?.def ?? '-').join() + me.inv.active;
    if (slotKey !== this.lastSlots) {
      this.lastSlots = slotKey;
      this.slots.innerHTML = '';
      me.inv.slots.forEach((s, i) => this.slots.append(h(`div${i === me.inv.active ? '.on' : ''}`, null, h('b', null, String(i + 1)), s ? WEAPONS[s.def].short : i === 0 ? 'Primary —' : 'Sidearm —')));
    }

    // ---- prompt
    const it = me.alive && m.phase === 'live' ? w.interactable(me) : null;
    if (it) {
      this.promptEl.classList.remove('hidden');
      this.promptEl.classList.toggle('blocked', !!it.blocked);
      setText(this.promptText, it.text);
      this.promptBar.style.width = `${(it.progress ?? 0) * 100}%`;
    } else this.promptEl.classList.add('hidden');

    // ---- spectate
    if (!me.alive && m.phase !== 'ended') {
      if (this.spectateEl.classList.contains('hidden')) {
        this.spectateEl.classList.remove('hidden');
        this.spectateEl.innerHTML = '';
        const allies = w.actors.some((a) => a.alive && a.team === me.team);
        const btn = h('button.btn.interactive', { onclick: () => this.onLeave() }, 'Leave operation');
        this.spectateEl.append(h('div.t', null, 'You are down'), h('div.s', null, allies ? 'Spectating your squad' : 'Awaiting outcome'), btn);
      }
    } else this.spectateEl.classList.add('hidden');
  }

  notice(text: string, tone: 'info' | 'good' | 'bad' = 'info') {
    const n = h(`div.notice.${tone}`, null, text);
    this.noticesEl.prepend(n);
    while (this.noticesEl.children.length > 3) this.noticesEl.lastElementChild?.remove();
    setTimeout(() => { n.style.opacity = '0'; n.style.transform = 'translateY(-6px)'; }, 3200);
    setTimeout(() => n.remove(), 3900);
  }

  killfeed(killer: string, victim: string, weapon: string, kt: string, vt: string, mine: boolean) {
    const row = h(`div.kf${mine ? '.me' : ''}`, null, h(`span.${kt}`, null, killer), h('span.w', null, weapon), h(`span.${vt}`, null, victim));
    this.killfeedEl.prepend(row);
    while (this.killfeedEl.children.length > 5) this.killfeedEl.lastElementChild?.remove();
    setTimeout(() => (row.style.opacity = '0'), 6000);
    setTimeout(() => row.remove(), 6700);
  }

  damage(angle: number | null, amount: number) {
    this.vignette.style.opacity = String(Math.min(0.9, 0.3 + amount / 40));
    setTimeout(() => (this.vignette.style.opacity = '0'), 160);
    if (angle !== null) {
      const i = h('i');
      i.style.transform = `rotate(${angle + Math.PI / 2}rad)`;
      this.dmgdir.append(i);
      setTimeout(() => i.remove(), 900);
    }
  }

  hitMarker(kill: boolean) {
    const r = document.querySelector('#game canvas')?.getBoundingClientRect();
    void r;
    this.hit.className = 'hitmarker';
    void this.hit.offsetWidth;
    this.hit.className = `hitmarker show${kill ? ' kill' : ''}`;
  }

  /** Position the hit marker on the crosshair (screen coords). */
  placeHit(x: number, y: number) {
    this.hit.style.left = `${x}px`;
    this.hit.style.top = `${y}px`;
  }

  coinPulse() {
    this.coins.classList.remove('pulse');
    void this.coins.offsetWidth;
    this.coins.classList.add('pulse');
  }

  detected() {
    this.detectedEl.classList.remove('show');
    void this.detectedEl.offsetWidth;
    this.detectedEl.classList.add('show');
    setTimeout(() => this.detectedEl.classList.remove('show'), 1600);
  }

  /** Large end-of-match banner shown before the results screen. */
  banner(won: boolean, reason: string) {
    this.brief.innerHTML = '';
    this.brief.append(h('div', null,
      h('div.op', null, 'Operation Night Shift'),
      h('h2', { style: { color: won ? 'var(--gold-hi)' : '#ff8a7e' } }, won ? 'Mission complete' : 'Mission failed'),
      h('p', null, reason)));
    this.brief.style.opacity = '1';
    this.brief.classList.remove('hidden');
  }

  stealth(hidden: boolean) {
    if (hidden) this.notice('Hidden in the shadows', 'info');
  }

  /** TAB overlay: scoreboard + inventory. */
  scoreboard(w: World, me: Actor | undefined): HTMLElement {
    const sb = w.scoreboard();
    const box = h('div.sb-box');
    for (const t of sb) {
      const col = h(`div.sb-team.${t.team}`, null, h('div.label', null, t.team === me?.team ? 'Your team' : 'Opposition'), h('h3', null, t.name),
        h('div.sb-row.label', null, h('span', null, 'Operator'), h('span', null, 'K'), h('span', null, 'D')));
      for (const m of t.members) {
        const hiddenName = me && t.team !== me.team && m.alive ? m.name : m.name;
        col.append(h(`div.sb-row${!m.alive ? '.dead' : ''}${m.id === me?.id ? '.me' : ''}`, null, h('span', null, hiddenName + (m.bot ? '' : ' ★')), h('span', null, String(m.kills)), h('span', null, String(m.deaths))));
      }
      box.append(col);
    }
    const inv = h('div', null, h('div.label', null, 'Inventory'));
    if (me) {
      me.inv.slots.forEach((s, i) => inv.append(h('div.inv-item', null, h('div.label', null, i === 0 ? 'Primary' : 'Sidearm'),
        h('div.in', null, s ? WEAPONS[s.def].name : 'Empty'), s ? h('div.ia', null, `${s.mag} / ${WEAPONS[s.def].magazine} · ${WEAPONS[s.def].caliber}`) : null)));
      inv.append(h('div.inv-item', null, h('div.label', null, 'Armor plates'), h('div.in', null, `${me.inv.plates} / ${me.mods.plateCapacity}`)));
      const at = h('div.ammo-table', null, h('div.label', { style: { margin: '10px 0 4px' } }, 'Reserve by caliber'));
      for (const c of CALIBERS) at.append(h('div', null, h('span', null, c), h('b', null, String(me.inv.reserve[c]))));
      inv.append(at);
    }
    box.append(inv);
    return h('div.scoreboard', null, box);
  }
}
