/** Radice dell'applicazione della homepage: la rete 3D è l'unica navigazione. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import graphJson from '../generated/graph.json';
import { NETWORK } from '../../config/network.ts';
import type { Graph } from '../core/types.ts';
import { createActivityEngine } from '../core/activity.ts';
import { buildSceneModel } from './scene/model.ts';
import { detectTier, hasWebGL2, isTouchPrimary, prefersReducedMotion } from './quality.ts';
import { VIEW_KEY, readSavedView, writeStore } from './storage.ts';
import type { FocusRequest, HoverInfo, SceneApi } from './types.ts';
import { Header } from './ui/Header.tsx';
import { PreviewPanel } from './ui/PreviewPanel.tsx';
import { SearchBox } from './ui/SearchBox.tsx';
import { IntroHint } from './ui/IntroHint.tsx';
import { SceneBoundary } from './SceneBoundary.tsx';
import { typeLabel } from './ui/format.ts';
import '../styles/app.css';

// La scena 3D (three + R3F) è il blocco più pesante: si carica separatamente dal resto dell'interfaccia.
const NetworkCanvas = lazy(() => import('./scene/NetworkCanvas.tsx'));

const graph = graphJson as unknown as Graph;

function setHash(id: string | null) {
  const url = location.pathname + location.search + (id ? `#${encodeURIComponent(id)}` : '');
  try { history.replaceState(history.state, '', url); } catch { /* ignorato */ }
}

export default function SinapsiApp() {
  const model = useMemo(() => buildSceneModel(graph, NETWORK), []);
  const engine = useMemo(() => createActivityEngine(model.adj, NETWORK.activity), [model]);

  // L'attività dipende dalla data corrente: si ricalcola nel browser (e ogni ora se la pagina resta aperta).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 3_600_000); return () => clearInterval(t); }, []);
  const activity = useMemo(() => engine.compute(model.ts, now), [engine, model, now]);

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [crashed, setCrashed] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const touch = useMemo(() => isTouchPrimary(), []);
  const tier = useMemo(() => detectTier(), []);
  const saved = useMemo(() => readSavedView(), []);
  const initialView = saved ? { p: saved.p, t: saved.t } : null;

  const [sel, setSel] = useState<number | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const seq = useRef(0);
  const sceneApi = useRef<SceneApi | null>(null);
  const selRef = useRef<number | null>(null);
  selRef.current = sel;

  useEffect(() => {
    const ok = hasWebGL2();
    setWebgl(ok);
    document.documentElement.classList.toggle('no-webgl', !ok);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('no-webgl', crashed || webgl === false); }, [crashed, webgl]);

  const select = useCallback((idx: number | null, o: { instant?: boolean; flash?: boolean } = {}) => {
    setSel(idx);
    setHover(null);
    if (idx === null) { setHash(null); return; }
    setFocus({ seq: ++seq.current, kind: 'node', idx, instant: o.instant, flash: o.flash });
    setHash(model.nodes[idx].id);
  }, [model]);

  const goHome = useCallback(() => {
    setSel(null); setHash(null);
    setFocus({ seq: ++seq.current, kind: 'home', idx: -1 });
  }, []);

  // Ripristino al ritorno da un articolo: posizione/orientamento/zoom della camera + nodo selezionato.
  useEffect(() => {
    if (webgl !== true) return;
    const id = decodeURIComponent(location.hash.slice(1)) || saved?.sel || '';
    const idx = id ? model.indexById.get(id) : undefined;
    if (idx === undefined) return;
    if (initialView) { setSel(idx); setHash(id); } // la camera è già nella posizione salvata
    else select(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  const saveView = useCallback(() => {
    const v = sceneApi.current?.getView();
    if (!v) return;
    const s = selRef.current;
    writeStore('session', VIEW_KEY, JSON.stringify({ ...v, sel: s !== null ? model.nodes[s].id : null }));
  }, [model]);
  useEffect(() => {
    const onHide = () => saveView();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [saveView]);

  const onPick = useCallback((idx: number | null) => select(idx), [select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (selRef.current !== null) select(null);
      } else if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, select]);

  const onSearchSelect = useCallback((nodeId: string) => {
    setSearchOpen(false);
    const idx = model.indexById.get(nodeId);
    if (idx !== undefined) select(idx, { flash: true }); // la camera accompagna il visitatore al nodo
  }, [model, select]);

  const empty = model.count === 0;
  const fallback = webgl === false || crashed;
  const hovered = hover && sel === null ? model.nodes[hover.idx] : null;

  return (
    <div className={`sinapsi${sel !== null ? ' has-focus' : ''}`}>
      {webgl && !crashed && !empty && (
        <SceneBoundary onError={() => setCrashed(true)}>
          <Suspense fallback={<div className="boot" role="status">Accendo la rete…</div>}>
            <NetworkCanvas
              model={model} activity={activity} selected={sel} focus={focus} initialView={initialView}
              reducedMotion={reducedMotion} tier={tier} apiRef={sceneApi} onPick={onPick} onHover={setHover}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {webgl === null && <div className="boot" role="status">Accendo la rete…</div>}

      <div className="scrim" aria-hidden="true" />
      <Header onSearch={() => setSearchOpen(true)} onHome={goHome} />

      {empty && (
        <div className="notice" role="status">
          <h1>La rete è ancora vuota</h1>
          <p>Aggiungi un file Markdown nella cartella <code>content/</code> e un nodo comparirà qui.</p>
        </div>
      )}
      {fallback && (
        <div className="notice" role="status">
          <h1>La rete 3D non è disponibile</h1>
          <p>Questo dispositivo o browser non può mostrarla. Tutti i contenuti restano raggiungibili dall’<a href="#indice">indice</a>.</p>
        </div>
      )}

      {hovered && hover && (
        <div className="tip" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 14}px)` }}>
          <strong>{hovered.label}</strong><small>{typeLabel(hovered.type)}</small>
        </div>
      )}

      {sel !== null && (
        <PreviewPanel model={model} idx={sel} onClose={() => select(null)} onSelect={(i) => select(i)} onOpen={saveView} />
      )}
      {searchOpen && <SearchBox model={model} onClose={() => setSearchOpen(false)} onSelect={onSearchSelect} />}
      {!empty && !fallback && sel === null && !searchOpen && <IntroHint touch={touch} />}
    </div>
  );
}
