/** Breve spiegazione dei controlli alla prima visita: piccola, chiudibile, non invadente. */
import { useState } from 'react';
import { INTRO_KEY, readStore, writeStore } from '../storage.ts';

export function IntroHint({ touch }: { touch: boolean }) {
  const [open, setOpen] = useState(() => readStore('local', INTRO_KEY) === null);
  if (!open) return null;
  const close = () => { writeStore('local', INTRO_KEY, '1'); setOpen(false); };
  return (
    <aside className="intro" aria-label="Come muoversi nella rete">
      <p>
        {touch
          ? 'Un dito per ruotare, due dita per ingrandire. Tocca un nodo per aprirlo.'
          : 'Trascina per ruotare, rotella per avvicinarti, tasto destro o Maiusc per spostarti. Clic su un nodo per aprirlo.'}
      </p>
      <p className="intro-sub">I nodi più luminosi sono gli argomenti trattati di recente; quelli spenti restano lì, in attesa.</p>
      <button type="button" onClick={close}>Ho capito</button>
    </aside>
  );
}
