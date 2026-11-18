import type { FoodItem } from "../types";
import { FOODS } from "../data/foods";

/**
 * Deterministic meal interpreter: turns "2 eggs, toast and a banana" into
 * editable database matches. Anything it can't match is returned as
 * unrecognised — it never invents foods or quantities. A language-model
 * interpreter can replace this behind the same interface later.
 */
export interface ParsedItem {
  food: FoodItem;
  servings: number;
  matchedText: string;
}

export interface ParseResult {
  items: ParsedItem[];
  unrecognised: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, couple: 2, some: 1,
};

function singular(w: string) {
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function matchFood(phrase: string): FoodItem | null {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;
  const ps = p.split(/\s+/).map(singular).join(" ");
  let best: { f: FoodItem; s: number } | null = null;
  for (const f of FOODS) {
    const keys = [f.name.toLowerCase(), f.id.replace(/_/g, " "), ...(f.tags ?? [])];
    for (const k of keys) {
      const ks = k.split(/[\s,]+/).map(singular).join(" ");
      let s = 0;
      if (ps === ks) s = 10;
      else if (ps.includes(ks)) s = 5 + ks.length / 10;
      else if (ks.includes(ps) && ps.length >= 4) s = 3 + ps.length / 10;
      else {
        const first = ks.split(" ")[0];
        if (first.length >= 4 && ps.split(" ").includes(first)) s = 2 + first.length / 10;
      }
      if (s > 0 && (!best || s > best.s)) best = { f, s };
    }
  }
  return best?.f ?? null;
}

export function parseMealDescription(text: string): ParseResult {
  const chunks = text
    .toLowerCase()
    .replace(/[.;]/g, ",")
    .split(/,|\band\b|\bwith\b|\bplus\b|\+|&/)
    .map((c) => c.trim())
    .filter(Boolean);
  const items: ParsedItem[] = [];
  const unrecognised: string[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|half|couple|some)\s*(?:of\s+)?(?:x\s+)?(.*)$/);
    let qty = 1;
    let rest = chunk;
    if (m) {
      qty = Number.isNaN(Number(m[1])) ? NUMBER_WORDS[m[1]] ?? 1 : Number(m[1]);
      rest = m[2];
    }
    rest = rest.replace(/^(slices?|pieces?|cups?|scoops?|bowls?|cans?|glass(es)?|servings?)\s+(of\s+)?/, "");
    const food = matchFood(rest);
    if (food) items.push({ food, servings: qty, matchedText: chunk });
    else unrecognised.push(chunk);
  }
  return { items, unrecognised };
}
