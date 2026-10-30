import { WEAPONS, WEAPON_IDS, WeaponId } from '../data/weapons';
import { SKILLS, SkillTree } from '../data/skills';
import { CONTRACTS, MISSION_REWARD, KILL_REWARD } from '../data/missions';
import { DIFFICULTIES, Difficulty } from '../data/difficulty';
import { profile } from '../progression/profile';
import { settings } from '../progression/settings';
import { weaponIcon } from '../render/textures';
import { h, ICONS } from './dom';

export type Section = 'deploy' | 'loadout' | 'skills' | 'missions' | 'profile' | 'settings';

export interface MenuHooks {
  deploy: (cfg: { team: 'AT' | 'GUARD'; difficulty: Difficulty; allies: number }) => void;
  sound: (key: 'ui_hover' | 'ui_click' | 'upgrade') => void;
}

const SECTIONS: { id: Section; label: string; sub: string }[] = [
  { id: 'deploy', label: 'Deploy', sub: 'Enter a match against bots' },
  { id: 'loadout', label: 'Loadout', sub: 'Weapons and equipment' },
  { id: 'skills', label: 'Skills', sub: 'Spend coins on mastery' },
  { id: 'missions', label: 'Missions', sub: 'Objectives and rewards' },
  { id: 'profile', label: 'Profile', sub: 'Career and statistics' },
  { id: 'settings', label: 'Settings', sub: 'Audio, video, controls' },
];

const CONTROLS: [string, string][] = [
  ['WASD', 'Move'], ['Shift', 'Run'], ['Mouse', 'Aim'], ['Space', 'Fire'], ['E', 'Interact / pick up'], ['R', 'Reload'],
  ['1 / 2', 'Primary / sidearm'], ['F', 'Flashlight'], ['Q', 'Apply armor plate'], ['Tab', 'Inventory & scoreboard'], ['Esc', 'Pause'], ['F3', 'FPS counter'],
];

export class MainMenu {
  readonly el: HTMLElement;
  private main = h('div.menu-main');
  private nav = h('div.nav');
  private foot = h('div.side-foot');
  private section: Section = 'deploy';
  private skillTab: SkillTree = 'weapon';
  private skillWeapon: WeaponId = 'pistol';
  private icons = new Map<WeaponId, string>();

  constructor(private hooks: MenuHooks) {
    for (const w of WEAPON_IDS) this.icons.set(w, weaponIcon(w));
    for (const s of SECTIONS) {
      const b = h(`button${s.id === 'deploy' ? '.deploy' : ''}`, { 'data-s': s.id, onmouseenter: () => hooks.sound('ui_hover'), onclick: () => { hooks.sound('ui_click'); this.open(s.id); } }, s.label, h('small', null, s.sub));
      this.nav.append(b);
    }
    this.el = h('div#menu.interactive', null,
      h('div.menu-side', null,
        h('div.logo', null, h('div.mark', null, 'The Grand Meridian'), h('h1', null, 'Project', h('br'), h('em', null, 'Hotel')), h('div.sub', null, 'One floor. Lights out. No second chances.')),
        this.nav,
        this.foot,
        h('div.version', null, 'v0.1 · Offline build')),
      this.main);
    this.open('deploy');
  }

  show() {
    this.el.classList.remove('hidden');
    this.open(this.section);
  }
  hide() {
    this.el.classList.add('hidden');
  }

  private refreshFoot() {
    const p = profile.get();
    const r = profile.rank();
    this.foot.innerHTML = '';
    this.foot.append(
      h('div.stat', null, h('div.label', null, 'Coins'), h('div.v.coins', { html: `<span class="coin-ico"></span>${p.coins}` })),
      h('div.stat', null, h('div.label', null, 'Rank'), h('div.v', null, r.name)),
      h('div.stat', null, h('div.label', null, 'Callsign'), h('div.v', null, p.callsign)),
    );
  }

  open(s: Section) {
    this.section = s;
    this.nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-s') === s));
    this.refreshFoot();
    this.main.innerHTML = '';
    const builders: Record<Section, () => HTMLElement> = {
      deploy: () => this.deployPanel(), loadout: () => this.loadoutPanel(), skills: () => this.skillsPanel(),
      missions: () => this.missionsPanel(), profile: () => this.profilePanel(), settings: () => this.settingsPanel(),
    };
    this.main.append(builders[s]());
  }

  private panel(kicker: string, title: string, body: HTMLElement, right?: HTMLElement) {
    return h('div.panel', null, h('div.panel-head', null, h('div', null, h('div.label', null, kicker), h('h2', null, title)), right ?? null), h('div.panel-scroll', null, body));
  }

  private seg<T extends string | number>(options: { v: T; label: string }[], value: T, onPick: (v: T) => void) {
    const el = h('div.seg');
    for (const o of options) {
      el.append(h(`button${o.v === value ? '.on' : ''}`, { onclick: () => { this.hooks.sound('ui_click'); onPick(o.v); }, onmouseenter: () => this.hooks.sound('ui_hover') }, o.label));
    }
    return el;
  }

  // ------------------------------------------------------------------ deploy
  private deployPanel() {
    const s = settings.get();
    const body = h('div');
    const card = (team: 'AT' | 'GUARD', name: string, color: string, text: string) =>
      h(`button.team-card${s.team === team ? '.on' : ''}`, { style: { '--c': color } as any, onclick: () => { this.hooks.sound('ui_click'); settings.set({ team }); this.open('deploy'); }, onmouseenter: () => this.hooks.sound('ui_hover') },
        h('div.label', null, team === 'AT' ? 'Assault' : 'Defend'), h('div.tname', null, name), h('p', null, text));
    body.append(h('div.team-cards', null,
      card('AT', 'Anti-Terrorist', '#6fb2e0', 'Infiltrate the hotel, find the three hostages hidden on the ground floor and escort them to the entrance. You start with a pistol and five rounds.'),
      card('GUARD', 'Hostage Guards', '#e37a72', 'Hold the hotel. The strike team will sweep the floor looking for the hostages. Stop every one of them, or run out the clock.')));
    const diff = DIFFICULTIES[s.difficulty];
    body.append(
      h('div.row', null, h('div', null, h('div.label', null, 'Difficulty'), h('div.desc', null, diff.description)),
        this.seg((['easy', 'normal', 'hard'] as Difficulty[]).map((d) => ({ v: d, label: DIFFICULTIES[d].label })), s.difficulty, (v) => { settings.set({ difficulty: v }); this.open('deploy'); })),
      h('div.row', null, h('div', null, h('div.label', null, 'Squad'), h('div.desc', null, 'AI teammates on your side. Both teams scale with squad size.')),
        this.seg([0, 1, 2, 3].map((n) => ({ v: n, label: n === 0 ? 'Solo' : `+${n}` })), s.allies, (v) => { settings.set({ allies: v }); this.open('deploy'); })),
      h('div.row', null, h('div', null, h('div.label', null, 'Operation'), h('div.desc', null, 'Grand Meridian Hotel · Ground floor · 3 hostages · 8:00 time limit')),
        h('div.label', { style: { color: 'var(--gold-hi)' } }, `Win +${MISSION_REWARD} · Kill +${KILL_REWARD}`)),
    );
    body.append(h('div.deploy-foot', null,
      h('div.brief', null, 'The power is out and every guard carries a flashlight. Stand still in a dark corner and you will slip into the shadows automatically.'),
      h('button.btn.primary', { onclick: () => { this.hooks.sound('ui_click'); this.hooks.deploy({ team: s.team, difficulty: s.difficulty, allies: s.allies }); }, onmouseenter: () => this.hooks.sound('ui_hover') }, 'Begin operation')));
    body.append(h('div.divider'), h('div.label', null, 'Controls'), h('div.controls-grid', null, ...CONTROLS.map(([k, d]) => h('div', null, h('span.kbd', null, k), d))));
    return this.panel('Mission setup', 'Deploy', body);
  }

  // ------------------------------------------------------------------ loadout
  private loadoutPanel() {
    const body = h('div');
    const grid = h('div.weapons');
    const maxDmg = 55, maxRpm = 800;
    for (const id of WEAPON_IDS) {
      const d = WEAPONS[id];
      const mastery = SKILLS.filter((s) => s.weapon === id).reduce((a, s) => a + profile.skillLevel(s.id), 0);
      const masteryMax = SKILLS.filter((s) => s.weapon === id).reduce((a, s) => a + s.costs.length, 0);
      const stat = (label: string, frac: number, val: string) => h('div.statline', null, h('span', null, label), h('div.bar', null, h('span', { style: { width: `${Math.round(Math.min(1, frac) * 100)}%` } })), h('span.val', null, val));
      const shotsToKill = Math.ceil(100 / d.damage);
      grid.append(h('div.wcard', null,
        h('div.wsub', null, `${d.slot === 0 ? 'Primary' : 'Sidearm'} · ${d.caliber} · ${d.automatic ? 'Auto' : 'Semi'}`),
        h('div.wn', null, d.name),
        h('img', { src: this.icons.get(id), alt: d.name }),
        h('p', null, d.description),
        stat('Damage', d.damage / maxDmg, `${shotsToKill} hits`),
        stat('Fire rate', d.rpm / maxRpm, String(d.rpm)),
        stat('Recoil', d.recoilKick / 0.24, d.recoilKick > 0.2 ? 'Severe' : d.recoilKick > 0.09 ? 'High' : 'Moderate'),
        stat('Accuracy', 1 - d.spread / 0.035, `${Math.round((1 - d.spread / 0.05) * 100)}`),
        stat('Lock speed', d.attractRate / 1.8, `${d.attractRate.toFixed(2)}`),
        stat('Magazine', d.magazine / 30, String(d.magazine)),
        stat('Mastery', mastery / masteryMax, `${mastery}/${masteryMax}`),
      ));
    }
    body.append(h('div.label', null, 'Arsenal'), h('div', { style: { height: '10px' } }), grid);
    body.append(h('div.divider'), h('div.label', null, 'Equipment'), h('div.equip', null,
      h('div', null, h('div.label', null, 'Always carried'), h('div.en', null, 'Flashlight'), h('p', null, 'Lights a cone ahead of you and reveals the room — and you. Toggle with F. Turns off automatically when you hide.')),
      h('div', null, h('div.label', null, 'Found in the hotel'), h('div.en', null, 'Armor plates'), h('p', null, `Each plate adds 50 armor. Carry ${profile.get().skills['general.carrier'] ? 2 + profile.get().skills['general.carrier'] : 2}. Applying takes about two seconds and blocks firing.`)),
      h('div', null, h('div.label', null, 'Starting kit'), h('div.en', null, 'P-45 · 5 rounds'), h('p', null, 'Every operator deploys light. Weapons, ammunition crates and plates must be found on the floor.')),
    ));
    return this.panel('Equipment', 'Loadout', body);
  }

  // ------------------------------------------------------------------ skills
  private skillsPanel() {
    const body = h('div');
    const tabs = h('div.tabs');
    const tabDefs: { id: SkillTree; label: string }[] = [{ id: 'weapon', label: 'Weapon mastery' }, { id: 'stealth', label: 'Stealth mastery' }, { id: 'general', label: 'General abilities' }];
    for (const t of tabDefs) tabs.append(h(`button${this.skillTab === t.id ? '.on' : ''}`, { onclick: () => { this.hooks.sound('ui_click'); this.skillTab = t.id; this.open('skills'); } }, t.label));
    body.append(tabs);
    if (this.skillTab === 'weapon') {
      const sub = h('div.subtabs');
      for (const w of WEAPON_IDS) sub.append(h(`button${this.skillWeapon === w ? '.on' : ''}`, { onclick: () => { this.hooks.sound('ui_click'); this.skillWeapon = w; this.open('skills'); } }, WEAPONS[w].name));
      body.append(sub);
    }
    const list = h('div.skills');
    const skills = SKILLS.filter((s) => s.tree === this.skillTab && (this.skillTab !== 'weapon' || s.weapon === this.skillWeapon));
    for (const s of skills) {
      const lv = profile.skillLevel(s.id);
      const cost = profile.nextCost(s.id);
      const pips = h('div.pips', null, ...s.costs.map((_, i) => h(`i${i < lv ? '.on' : ''}`)));
      const node = h(`div.skill${cost === null ? '.max' : ''}`, { 'data-id': s.id },
        h('div.ico', { html: ICONS[s.icon] ?? ICONS.target }),
        h('div', null, h('div.sn', null, s.name), h('div.sd', null, s.description), h('div.se', null, lv > 0 ? `Now: ${s.effect(lv)}` : `Next: ${s.effect(1)}`), pips),
      );
      const btn = h('button.buy', {
        disabled: cost === null || profile.get().coins < (cost ?? 0),
        onmouseenter: () => this.hooks.sound('ui_hover'),
        onclick: () => {
          if (!profile.upgrade(s.id)) return;
          this.hooks.sound('upgrade');
          this.open('skills');
          const el = this.main.querySelector(`.skill[data-id="${s.id}"]`);
          el?.classList.add('unlock');
        },
      }, cost === null ? 'Mastered' : h('span', { html: `<span class="coin-ico"></span>${cost}` }));
      node.append(btn);
      list.append(node);
    }
    body.append(list);
    body.append(h('div.divider'), h('div.label', null, `Earn coins: +${KILL_REWARD} per elimination (collect the coin they drop), +${MISSION_REWARD} per completed mission or contract.`));
    return this.panel('Progression', 'Skills', body, h('div', { style: { textAlign: 'right' } }, h('div.label', null, 'Available'), h('div.coins-big', { html: `<span class="coin-ico"></span>${profile.get().coins}` })));
  }

  // ------------------------------------------------------------------ missions
  private missionsPanel() {
    const p = profile.get();
    const body = h('div');
    body.append(h('div.op-card', null,
      h('div.label', null, `Primary operation · +${MISSION_REWARD} coins on success`),
      h('h3', null, 'Night Shift at the Grand Meridian'),
      h('p', null, 'Armed guards have taken the ground floor and hidden three hostages among its rooms. As the Anti-Terrorist unit: free them and walk them out through the entrance, or neutralize every guard. As the Hostage Guards: eliminate the strike team or hold out for eight minutes.')));
    body.append(h('div.label', null, 'Contracts · one-time rewards'));
    for (const c of CONTRACTS) {
      const done = p.claimedContracts.includes(c.id);
      const prog = Math.min(c.goal, c.progress(p.stats));
      body.append(h(`div.contract${done ? '.done' : ''}`, null,
        h('div', null, h('div.cn', null, (done ? '✓ ' : '') + c.name), h('div.cd', null, c.description)),
        h('div', null, h('div.bar', null, h('span', { style: { width: `${(prog / c.goal) * 100}%` } })), h('div.prog', null, done ? 'Completed' : `${prog} / ${c.goal}`)),
        h('div.reward', { html: `<span class="coin-ico"></span>${c.reward}` })));
    }
    return this.panel('Objectives', 'Missions', body);
  }

  // ------------------------------------------------------------------ profile
  private profilePanel() {
    const p = profile.get();
    const s = p.stats;
    const r = profile.rank();
    const body = h('div');
    const input = h('input.callsign', { value: p.callsign, maxlength: 18, onchange: (e: Event) => { profile.setCallsign((e.target as HTMLInputElement).value.trim()); this.refreshFoot(); } }) as HTMLInputElement;
    input.addEventListener('keydown', (e) => e.stopPropagation());
    const frac = r.next ? (r.xp - r.prev) / (r.next - r.prev) : 1;
    body.append(h('div.rank', null,
      h('div.emblem', null, h('span', null, String(r.index + 1))),
      h('div', { style: { flex: '1' } }, h('div.label', null, 'Callsign'), input, h('div.rn', null, r.name),
        h('div.bar', { style: { marginTop: '8px', maxWidth: '360px' } }, h('span', { style: { width: `${frac * 100}%` } })),
        h('div.label', { style: { marginTop: '6px' } }, r.next ? `${r.xp} / ${r.next} XP` : `${r.xp} XP · Highest rank`))));
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : String(s.kills);
    const mins = Math.floor(s.playSeconds / 60);
    const stat = (label: string, v: string) => h('div', null, h('div.label', null, label), h('div.v', null, v));
    body.append(h('div.stats-grid', null,
      stat('Operations', String(s.matches)), stat('Victories', String(s.wins)), stat('Eliminations', String(s.kills)), stat('K / D', kd),
      stat('Accuracy', `${acc}%`), stat('Hostages saved', String(s.hostagesRescued)), stat('Time hidden', `${Math.floor(s.hiddenSeconds)}s`), stat('Time played', `${mins}m`),
      stat('Pistol kills', String(s.weaponKills.pistol)), stat('MP5 kills', String(s.weaponKills.mp5)), stat('M4 kills', String(s.weaponKills.m4)), stat('Deagle kills', String(s.weaponKills.deagle)),
    ));
    const hist = h('div.history', null, h('div.label', null, 'Recent operations'));
    if (!p.history.length) hist.append(h('div.desc', { style: { color: 'var(--ink-faint)', padding: '10px 0', fontSize: '13px' } }, 'No operations yet. Deploy to start your record.'));
    for (const m of p.history) {
      const d = new Date(m.date);
      hist.append(h('div.h', null, h('span', { class: m.won ? 'w' : 'l' }, m.won ? 'Victory' : 'Defeat'), h('span', null, `${m.team === 'AT' ? 'Anti-Terrorist' : 'Guards'} · ${m.difficulty}`),
        h('span', null, `${m.kills} kills`), h('span', null, `+${m.coins} coins`), h('span', null, d.toLocaleDateString())));
    }
    body.append(hist);
    let armed = false;
    const reset = h('button.btn.danger', {
      onclick: () => {
        if (!armed) { armed = true; reset.textContent = 'Click again to erase all progress'; return; }
        profile.reset(); this.open('profile');
      },
    }, 'Reset progress');
    body.append(h('div.divider'), reset);
    return this.panel('Career', 'Profile', body);
  }

  // ------------------------------------------------------------------ settings
  private settingsPanel() {
    const s = settings.get();
    const body = h('div');
    body.append(...settingsRows(() => this.open('settings'), this.hooks.sound));
    body.append(h('div.divider'), h('div.label', null, 'Controls'), h('div.controls-grid', null, ...CONTROLS.map(([k, d]) => h('div', null, h('span.kbd', null, k), d))));
    void s;
    return this.panel('Options', 'Settings', body);
  }
}

/** Settings rows shared by the main menu and the pause menu. */
export function settingsRows(refresh: () => void, sound: (k: 'ui_hover' | 'ui_click') => void): HTMLElement[] {
  const s = settings.get();
  const slider = (label: string, key: 'master' | 'sfx' | 'ambience' | 'ui') => {
    const val = h('span.sv', null, String(Math.round(s[key] * 100)));
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100), oninput: (e: Event) => { const v = +(e.target as HTMLInputElement).value / 100; settings.set({ [key]: v } as any); val.textContent = String(Math.round(v * 100)); } });
    return h('div.row', null, h('div.label', null, label), h('div.slider', null, input, val));
  };
  const seg = <T extends string | boolean>(opts: { v: T; label: string }[], value: T, pick: (v: T) => void) => {
    const el = h('div.seg');
    for (const o of opts) el.append(h(`button${o.v === value ? '.on' : ''}`, { onclick: () => { sound('ui_click'); pick(o.v); refresh(); } }, o.label));
    return el;
  };
  return [
    slider('Master volume', 'master'), slider('Effects', 'sfx'), slider('Ambience', 'ambience'), slider('Interface', 'ui'),
    h('div.row', null, h('div', null, h('div.label', null, 'Lighting quality'), h('div.desc', null, 'High uses finer shadows and soft edges.')), seg([{ v: 'high', label: 'High' }, { v: 'low', label: 'Performance' }], s.lighting, (v) => settings.set({ lighting: v as 'high' | 'low' }))),
    h('div.row', null, h('div.label', null, 'Screen shake'), seg([{ v: true, label: 'On' }, { v: false, label: 'Off' }], s.screenShake, (v) => settings.set({ screenShake: v as boolean }))),
    h('div.row', null, h('div', null, h('div.label', null, 'FPS counter'), h('div.desc', null, 'Development overlay. Toggle in game with F3.')), seg([{ v: true, label: 'On' }, { v: false, label: 'Off' }], s.showFps, (v) => settings.set({ showFps: v as boolean }))),
  ];
}
