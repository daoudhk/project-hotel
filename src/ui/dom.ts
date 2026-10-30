/** Tiny DOM builder: h('div.cls#id', {attrs}, children...) */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, attrs: Record<string, any> | null = null, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const tag = (m?.[1] || 'div') as K;
  const el = document.createElement(tag);
  for (const part of (m?.[2] ?? '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
          else (el.style as any)[sk] = sv;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export function setText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

export const ICONS: Record<string, string> = {
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  recoil: '<svg viewBox="0 0 24 24"><path d="M4 16l6-6 4 4 6-8"/><path d="M15 6h5v5"/></svg>',
  recovery: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/></svg>',
  steady: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/><path d="M8 8v8M16 8v8M12 5v14"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><path d="M4 4l16 16"/></svg>',
  feet: '<svg viewBox="0 0 24 24"><ellipse cx="8" cy="9" rx="3" ry="5"/><ellipse cx="16" cy="15" rx="3" ry="5"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/></svg>',
  run: '<svg viewBox="0 0 24 24"><path d="M4 18l5-1 2-4 4 3v5"/><path d="M8 9l4-3 4 2 3 4"/><circle cx="15" cy="4" r="1.5"/></svg>',
  plate: '<svg viewBox="0 0 24 24"><path d="M6 4h12v9c0 4-6 7-6 7s-6-3-6-7z"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 11a1.5 1.5 0 0 1 3 0v3c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 0 1 3-1l1 2"/></svg>',
  vest: '<svg viewBox="0 0 24 24"><path d="M8 3l-4 3v14h6v-6h4v6h6V6l-4-3-2 3h-4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="#d9584c"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="#6fb2e0"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/></svg>',
  eyeOpen: '<svg viewBox="0 0 26 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8s4.5-7 12-7 12 7 12 7-4.5 7-12 7S1 8 1 8z"/><circle cx="13" cy="8" r="3"/></svg>',
  eyeClosed: '<svg viewBox="0 0 26 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 6s4.5 6 12 6 12-6 12-6"/><path d="M5 10l-2 3M13 12v3M21 10l2 3"/></svg>',
};
