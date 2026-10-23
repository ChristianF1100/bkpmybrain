/** Ricerca full-text statica: l'indice (generato in build) si carica solo alla prima apertura. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { searchIndex } from '../../core/search.ts';
import type { SearchIndex } from '../../core/search.ts';
import { stripAccents } from '../../core/text.ts';
import type { SceneModel } from '../scene/model.ts';
import { typeLabel } from './format.ts';
import { TYPE_LABELS } from '../../core/types.ts';
import type { ContentType } from '../../core/types.ts';

interface Result { id: string; title: string; kind: string; sub: string; color: string }

export function SearchBox({ model, onClose, onSelect }: { model: SceneModel; onClose: () => void; onSelect: (nodeId: string) => void }) {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    import('../../generated/search-index.json')
      .then((m) => setIndex(((m as { default?: unknown }).default ?? m) as unknown as SearchIndex))
      .catch(() => setError(true));
  }, []);

  const results = useMemo<Result[]>(() => {
    const query = q.trim();
    if (!query) return [];
    const nq = stripAccents(query).toLowerCase();
    const topics: Result[] = model.topicIdx
      .map((i) => model.nodes[i])
      .filter((n) => !n.secret && stripAccents(n.label).toLowerCase().includes(nq))
      .map((n) => ({ id: n.id, title: n.label, kind: 'Argomento', sub: n.desc, color: n.color }));
    const docs: Result[] = index
      ? searchIndex(index, query, 8).map(({ doc }) => {
          const node = model.nodes[model.indexById.get(doc.i) ?? 0];
          const ty = (doc.y in TYPE_LABELS ? doc.y : 'article') as ContentType;
          return {
            id: doc.i, title: doc.t || node?.label || doc.d, kind: typeLabel(ty),
            sub: doc.g.join(', '), color: node?.color ?? '#8fb1ba',
          };
        })
      : [];
    return [...topics.slice(0, 3), ...docs].slice(0, 9);
  }, [q, index, model]);

  useEffect(() => setActive(0), [q]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); onSelect(results[active].id); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="search-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="search" role="dialog" aria-label="Cerca nella rete">
        <input
          ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          type="search" placeholder="Cerca titoli, tag, tipologie o parole nei testi" autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={results.length > 0} aria-controls="search-results" aria-activedescendant={results[active] ? `sr-${active}` : undefined}
        />
        <ul id="search-results" role="listbox" className="results">
          {results.map((r, i) => (
            <li key={r.id} id={`sr-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => onSelect(r.id)} style={{ ['--accent' as string]: r.color } as CSSProperties}>
                <span className="dot" aria-hidden="true" />
                <span className="r-main"><strong>{r.title}</strong>{r.sub && <small>{r.sub}</small>}</span>
                <span className="r-kind">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
        {q.trim() && results.length === 0 && index && <p className="search-note">Nessun risultato per «{q.trim()}». Prova con un tag o una parte di parola.</p>}
        {q.trim() && !index && !error && <p className="search-note">Carico l'indice…</p>}
        {error && <p className="search-note">Impossibile caricare l'indice di ricerca. Ricarica la pagina.</p>}
        {!q.trim() && <p className="search-note">Scegli un risultato: la camera ti accompagnerà al suo nodo nella rete.</p>}
      </div>
    </div>
  );
}
