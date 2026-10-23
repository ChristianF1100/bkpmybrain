/** Pannello centrale di anteprima: contenuto (con pulsante Apri) o argomento (con i contenuti collegati). */
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { withBase } from '../../lib/url.ts';
import type { SceneModel } from '../scene/model.ts';
import { formatDate, typeLabel } from './format.ts';

interface Props {
  model: SceneModel;
  idx: number;
  onClose: () => void;
  onSelect: (idx: number) => void;
  onOpen: () => void;
}

export function PreviewPanel({ model, idx, onClose, onSelect, onOpen }: Props) {
  const n = model.nodes[idx];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [idx]);

  const topicIdx = n.topics.map((t) => model.indexById.get(`t:${t}`)).filter((i): i is number => i !== undefined);
  const linked = n.kind === 'topic'
    ? model.adj[idx].map((e) => e.to).filter((i) => model.nodes[i].kind === 'content')
        .sort((a, b) => (model.nodes[b].date ?? '').localeCompare(model.nodes[a].date ?? ''))
    : [];
  const shown = linked.slice(0, 8);
  const heading = n.kind === 'topic' || n.titled ? n.label : typeLabel(n.type);
  const color = { ['--accent' as string]: n.color } as CSSProperties;

  return (
    <div className="preview" role="dialog" aria-modal="false" aria-labelledby="preview-title" ref={ref} tabIndex={-1} style={color}>
      <button type="button" className="preview-close" onClick={onClose} aria-label="Chiudi anteprima">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      <p className="preview-meta">
        <span className="dot" aria-hidden="true" />
        <span>{typeLabel(n.type)}</span>
        {n.date && <time dateTime={n.date}>{formatDate(n.date)}</time>}
      </p>
      <h2 id="preview-title" className={n.titled || n.kind === 'topic' ? '' : 'untitled'}>{heading}</h2>
      {n.desc && <p className="preview-desc">{n.desc}</p>}

      {n.kind === 'content' && topicIdx.length > 0 && (
        <ul className="chips" aria-label="Argomenti collegati">
          {topicIdx.map((t) => (
            <li key={t}>
              <button type="button" className="chip" onClick={() => onSelect(t)} style={{ ['--chip' as string]: model.nodes[t].color } as CSSProperties}>
                {model.nodes[t].label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {n.kind === 'topic' && (
        <>
          <p className="preview-count">{linked.length === 0 ? 'Nessun contenuto collegato.' : `${linked.length} ${linked.length === 1 ? 'contenuto' : 'contenuti'}`}</p>
          {shown.length > 0 && (
            <ul className="linked" aria-label="Contenuti di questo argomento">
              {shown.map((i) => (
                <li key={i}>
                  <button type="button" onClick={() => onSelect(i)}>
                    <span>{model.nodes[i].label}</span>
                    <small>{typeLabel(model.nodes[i].type)}</small>
                  </button>
                </li>
              ))}
              {linked.length > shown.length && <li className="more">e altri {linked.length - shown.length} nella rete</li>}
            </ul>
          )}
        </>
      )}

      {n.kind === 'content' && n.url && (
        <a className="btn-open" href={withBase(n.url)} onClick={onOpen}>Apri</a>
      )}
    </div>
  );
}
