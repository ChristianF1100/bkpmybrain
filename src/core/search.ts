/** Ricerca testuale statica: indice invertito generato in build, interrogato nel browser. */
import { stripAccents, tokenize } from './text.ts';

export interface SearchInput {
  id: string; title: string; desc: string; type: string; typeLabel: string;
  tags: string[]; shown: string[]; text: string; ts: number;
}
export interface SearchDocMeta { i: string; t: string; d: string; y: string; g: string[]; s: number }
export interface SearchIndex {
  v: 1;
  docs: SearchDocMeta[];
  /** termini ordinati (per la ricerca per prefisso con ricerca binaria) */
  terms: string[];
  /** post[k] = [doc, punteggio, doc, punteggio, …] */
  post: number[][];
}
export interface SearchHit { doc: SearchDocMeta; score: number }

const W = { title: 6, tags: 5, type: 4, desc: 2, text: 1 };

export function buildSearchIndex(inputs: SearchInput[]): SearchIndex {
  const docs: SearchDocMeta[] = [];
  const map = new Map<string, Map<number, number>>();
  const add = (field: string, weight: number, di: number) => {
    const counts = new Map<string, number>();
    for (const t of tokenize(field)) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [t, c] of counts) {
      let m = map.get(t);
      if (!m) { m = new Map(); map.set(t, m); }
      m.set(di, (m.get(di) ?? 0) + weight * Math.min(c, 3));
    }
  };
  inputs.forEach((x, di) => {
    docs.push({ i: x.id, t: x.title, d: x.desc.slice(0, 200), y: x.type, g: x.shown, s: x.ts });
    add(x.title, W.title, di);
    add(x.tags.join(' ').replace(/-/g, ' ') + ' ' + x.tags.join(' '), W.tags, di);
    add(`${x.typeLabel} ${x.type}`, W.type, di);
    add(x.desc, W.desc, di);
    add(x.text, W.text, di);
  });
  const terms = [...map.keys()].sort();
  const post = terms.map((t) => {
    const flat: number[] = [];
    for (const [d, s] of [...(map.get(t) as Map<number, number>)].sort((a, b) => a[0] - b[0])) flat.push(d, s);
    return flat;
  });
  return { v: 1, docs, terms, post };
}

function lowerBound(terms: string[], key: string): number {
  let lo = 0, hi = terms.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (terms[mid] < key) lo = mid + 1; else hi = mid; }
  return lo;
}

export function searchIndex(index: SearchIndex, query: string, limit = 10): SearchHit[] {
  const tokens = [...new Set(tokenize(stripAccents(query)))];
  if (!tokens.length) return [];
  const perToken: Map<number, number>[] = tokens.map((tok) => {
    const m = new Map<number, number>();
    const start = lowerBound(index.terms, tok);
    for (let k = start; k < index.terms.length && k < start + 400 && index.terms[k].startsWith(tok); k++) {
      const exact = index.terms[k] === tok ? 2 : 1;
      const p = index.post[k];
      for (let j = 0; j < p.length; j += 2) {
        const s = p[j + 1] * exact;
        if (s > (m.get(p[j]) ?? 0)) m.set(p[j], s);
      }
    }
    return m;
  });
  const totals = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const m of perToken) for (const [d, s] of m) { totals.set(d, (totals.get(d) ?? 0) + s); counts.set(d, (counts.get(d) ?? 0) + 1); }
  let ids = [...totals.keys()].filter((d) => counts.get(d) === tokens.length);
  let penalty = 1;
  if (ids.length === 0 && tokens.length > 1) { ids = [...totals.keys()]; penalty = 0.5; }
  return ids
    .map((d) => ({ doc: index.docs[d], score: (totals.get(d) as number) * penalty * (counts.get(d) as number) }))
    .sort((a, b) => b.score - a.score || b.doc.s - a.doc.s || (a.doc.i < b.doc.i ? -1 : 1))
    .slice(0, limit);
}
