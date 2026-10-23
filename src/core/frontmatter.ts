/**
 * Parser di frontmatter YAML senza dipendenze.
 *
 * Sottoinsieme supportato (sufficiente per i metadati dei contenuti):
 *  - scalari: stringhe (anche tra apici), numeri, true/false, null
 *  - liste inline `[a, b]` e a blocchi (`- a`)
 *  - mappe annidate e liste di mappe (`- src: x` + `  alt: y`)
 *  - commenti `# ...`
 * NON supportati (generano un errore chiaro): blocchi `|` / `>`, ancore, tag YAML, tabulazioni.
 * Le date restano stringhe (`2026-10-14`): non vengono mai convertite in oggetti Date.
 */
export class YamlError extends Error {}

interface Line { indent: number; text: string; no: number }

function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '\\' && q === '"') i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      if (i === 0 || /[\s:[{,-]/.test(s[i - 1])) q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i);
    }
  }
  return s;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, q: string | null = null, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      cur += c;
      if (c === '\\' && q === '"') { cur += s[++i] ?? ''; continue; }
      if (c === q) q = null;
    } else if (c === '"' || c === "'") { q = c; cur += c; }
    else if (c === '[' || c === '{') { depth++; cur += c; }
    else if (c === ']' || c === '}') { depth--; cur += c; }
    else if (c === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += c;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseScalar(raw: string, no: number): unknown {
  const s = raw.trim();
  if (s === '') return null;
  const c = s[0];
  if (c === '"') {
    try { return JSON.parse(s) as string; }
    catch { throw new YamlError(`riga ${no}: stringa tra virgolette non valida`); }
  }
  if (c === "'") {
    if (s.length < 2 || !s.endsWith("'")) throw new YamlError(`riga ${no}: apice non chiuso`);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (c === '[') {
    if (!s.endsWith(']')) throw new YamlError(`riga ${no}: lista inline non chiusa`);
    return splitTop(s.slice(1, -1)).map((p) => parseScalar(p, no));
  }
  if (c === '{') {
    if (!s.endsWith('}')) throw new YamlError(`riga ${no}: mappa inline non chiusa`);
    const out: Record<string, unknown> = {};
    for (const part of splitTop(s.slice(1, -1))) {
      const m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(part);
      if (!m) throw new YamlError(`riga ${no}: voce di mappa inline non valida`);
      out[m[1].replace(/^["']|["']$/g, '')] = parseScalar(m[2], no);
    }
    return out;
  }
  if (c === '|' || c === '>') throw new YamlError(`riga ${no}: i blocchi multilinea (| e >) non sono supportati: usa una stringa tra virgolette`);
  if (c === '&' || c === '*' || c === '!') throw new YamlError(`riga ${no}: ancore e tag YAML non sono supportati`);
  if (c === '@' || c === '`' || c === '%') throw new YamlError(`riga ${no}: un valore non può iniziare con "${c}": mettilo tra virgolette`);
  // Come YAML standard (e quindi come Astro): ": " dentro un valore non quotato è un errore. Meglio scoprirlo qui, con un messaggio chiaro.
  if (/:(\s|$)/.test(s)) throw new YamlError(`riga ${no}: il valore contiene ":" — mettilo tra virgolette ("…")`);
  if (/^(true|True)$/.test(s)) return true;
  if (/^(false|False)$/.test(s)) return false;
  if (/^(null|Null|~)$/.test(s)) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function toLines(src: string): Line[] {
  const lines: Line[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const t = stripComment(raw).replace(/\s+$/, '');
    if (t.trim() === '') return;
    if (/^\t/.test(t)) throw new YamlError(`riga ${i + 1}: le tabulazioni non sono ammesse per l'indentazione`);
    const indent = t.length - t.trimStart().length;
    lines.push({ indent, text: t.trim(), no: i + 1 });
  });
  return lines;
}

const isItem = (l: Line): boolean => l.text === '-' || l.text.startsWith('- ');
const MAP_ITEM = /^[^:[\]{}"',]+?:(\s|$)/;

function parseBlock(lines: Line[], i: number, indent: number): [unknown, number] {
  return isItem(lines[i]) ? parseList(lines, i, indent) : parseMap(lines, i, indent);
}

function parseMap(lines: Line[], start: number, indent: number): [Record<string, unknown>, number] {
  const out: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent && !isItem(lines[i])) {
    const ln = lines[i];
    const m = /^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/.exec(ln.text);
    if (!m) throw new YamlError(`riga ${ln.no}: attesa la forma "chiave: valore"`);
    const key = m[1].replace(/^["']|["']$/g, '');
    const rest = m[2];
    i++;
    if (rest !== undefined && rest.trim() !== '') { out[key] = parseScalar(rest, ln.no); continue; }
    const nxt = lines[i];
    if (nxt && (nxt.indent > indent || (nxt.indent === indent && isItem(nxt)))) {
      const [v, ni] = parseBlock(lines, i, nxt.indent);
      out[key] = v; i = ni;
    } else out[key] = null;
  }
  if (i < lines.length && lines[i].indent > indent) throw new YamlError(`riga ${lines[i].no}: indentazione inattesa`);
  return [out, i];
}

function parseList(lines: Line[], start: number, indent: number): [unknown[], number] {
  const out: unknown[] = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent && isItem(lines[i])) {
    const ln = lines[i];
    const rest = ln.text === '-' ? '' : ln.text.slice(2);
    if (rest.trim() === '') {
      i++;
      const nxt = lines[i];
      if (nxt && nxt.indent > indent) { const [v, ni] = parseBlock(lines, i, nxt.indent); out.push(v); i = ni; }
      else out.push(null);
    } else if (MAP_ITEM.test(rest)) {
      lines[i] = { indent: indent + 2, text: rest, no: ln.no };
      const [v, ni] = parseMap(lines, i, indent + 2);
      out.push(v); i = ni;
    } else { out.push(parseScalar(rest, ln.no)); i++; }
  }
  return [out, i];
}

export function parseYaml(src: string): Record<string, unknown> {
  const lines = toLines(src);
  if (lines.length === 0) return {};
  const [val, next] = parseBlock(lines, 0, lines[0].indent);
  if (next < lines.length) throw new YamlError(`riga ${lines[next].no}: indentazione non valida`);
  if (typeof val !== 'object' || val === null || Array.isArray(val)) throw new YamlError('il frontmatter deve essere una mappa chiave: valore');
  return val as Record<string, unknown>;
}

export interface Parsed { data: Record<string, unknown>; body: string; hasFrontmatter: boolean }

export function parseFrontmatter(source: string): Parsed {
  const m = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!m) return { data: {}, body: source, hasFrontmatter: false };
  return { data: parseYaml(m[1] ?? ''), body: source.slice(m[0].length), hasFrontmatter: true };
}
