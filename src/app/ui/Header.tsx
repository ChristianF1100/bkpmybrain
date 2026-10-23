/** Unici elementi permanenti dell'interfaccia: logo bkpmybrain e ricerca. */
export function Header({ onSearch, onHome }: { onSearch: () => void; onHome: () => void }) {
  return (
    <header className="hud">
      <button type="button" className="brand" onClick={onHome} aria-label="bkpmybrain: torna alla visuale iniziale">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
            <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z" />
            <path d="M12 2.5v19M3.8 7.25l16.4 9.5M20.2 7.25 3.8 16.75" opacity=".45" />
          </g>
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
        <span>bkpmybrain</span>
      </button>
      <button type="button" className="icon-btn" onClick={onSearch} aria-label="Cerca nella rete (tasto /)" title="Cerca ( / )">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" />
          </g>
        </svg>
      </button>
    </header>
  );
}
