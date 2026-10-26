/**
 * Parametri della rete bkpmybrain — TUTTE le manopole in un solo posto.
 * Nessun valore di questo file è scritto dentro i componenti React.
 * (Il colore degli argomenti e le loro posizioni stanno in config/topics.json.)
 */
import type { NetworkConfig } from '../src/core/types.ts';

export const NETWORK: NetworkConfig = {
  /* ---------- Palette ---------- */
  palette: {
    background: '#02080b',
    neutral: '#8fb1ba', // contenuti senza argomento
    // usati per gli argomenti creati automaticamente (scelti in modo stabile dall'id)
    autoColors: ['#9fc6e8', '#c9a6e8', '#e8c28f', '#8fe0c4', '#e8a0b4', '#b8d68c'],
  },

  /* ---------- Attività neurale (basata sulle date di pubblicazione) ---------- */
  activity: {
    minBrightness: 0.08,   // luminosità minima: i nodi non scompaiono mai
    halfLifeDays: 30,      // tempo di dimezzamento dell'attività
    strongLinkPass: 0.55,  // quota di impulso che attraversa un collegamento forte
    maxHops: 3,            // profondità massima di propagazione
    maxActivity: 1,        // attività massima
    weightExponent: 2,     // >1 = i collegamenti deboli propagano molto meno di quelli forti (più contrasto)
    cutoffHalfLives: 12,   // oltre 12 emivite l'impulso è trascurabile (ottimizzazione)
    minPropagated: 0.002,  // sotto questa ampiezza la propagazione si ferma
  },
  /** Forza strutturale: più alta la scala, più contenuti servono per saturare. */
  structural: { topicScale: 8, contentScale: 3 },

  /* ---------- Collegamenti automatici ---------- */
  links: {
    topicTagWeight: 1,        // peso dei tag che coincidono con un argomento
    minorTagWeight: 0.6,      // peso dei tag "minori"
    strengthGain: 1.6,        // ripidità della curva somma-pesi → forza (0..1)
    minStrength: 0.2,         // sotto questa forza il collegamento non viene creato
    maxSecondaryLinks: 4,     // collegamenti contenuto↔contenuto per nodo
    maxTagFanout: 60,         // tag usati da più contenuti non generano coppie
    explicitWeight: 1,        // peso dei collegamenti dichiarati con `related:`
    topicLinkDecay: 0.18,     // il 1° tag vale 1, il 2° 0.82, …
    topicLinkFloor: 0.45,
    maxTopicsPerContent: 4,
    topicCoocGain: 0.5,       // forza dei ponti tra argomenti che condividono contenuti
    topicMinStrength: 0.3,
    maxTopicLinks: 5,
    autoTopicMinCount: 3,     // un tag usato da ≥3 contenuti diventa un argomento da solo
    // Tag equivalenti: il primo di ogni gruppo è quello canonico
    equivalences: [
      ['riparazioni', 'riparazione', 'riparare'],
      ['esperimenti', 'esperimento'],
      ['batterie', 'batteria'],
      ['pensieri', 'pensiero'],
      ['video', 'filmati'],
    ],
  },

  /* ---------- Posizionamento ---------- */

layout: {
  radius: 35,
  zoneRanges: {
    core: [0, 0.3],
    mid: [0.3, 0.62],
    branch: [0.62, 0.95],
    remote: [1.1, 1.4]
  },
  minAnchorDistance: 14,
  cloudRadius: 6.5,
  cloudMinFraction: 0.3,
  branchStretch: 1.5,
  minNodeDistance: 3,
  topicClearance: 6,
  attempts: 64,
  secondaryWeights: [0.55, 0.35, 0.25],
  decimals: 3,
},
  /* ---------- Aspetto dei nodi ---------- */
  nodes: {
    topicBase: 2.3, topicGrow: 1.5, contentBase: 0.9,
    typeScale: {
      article: 1, note: 0.8, fragment: 0.58, project: 1.3, photo: 0.95,
      video: 1, code: 1, memory: 0.95, mixed: 1,
    },
    coreSize: 0.26,   // nucleo luminoso (unità di scena)
    haloSize: 3.2,    // alone soffuso
  },

  /* ---------- Illuminazione ---------- */
  lighting: {
    lineMin: 0.16, lineMax: 0.9,    // opacità dei wireframe tra nodo dormiente e nodo attivo
    filMin: 0.07, filMax: 0.6,      // opacità dei filamenti
    haloStrength: 0.2, coreStrength: 0.95,
    fogNear: 30, fogFar: 190,       // attenuazione con la distanza
    detailNear: 38, detailFar: 95,  // sotto questa distanza compaiono i dettagli interni dei nodi
    dimOthers: 0.14,                // luminosità del resto della rete quando un nodo è in primo piano
    dimNeighbors: 0.72,
  },

  /* ---------- Movimento ---------- */
  motion: {
    wobbleAmplitude: 0.24,   // oscillazione dei nodi (unità di scena) attorno alla posizione stabile
    filamentSway: 0.35,
    timeScale: 1,
    spinSpeed: 0.05,         // rotazione lentissima di ogni nodo su se stesso (rad/s)
    pulseMinRate: 0.05,      // probabilità di impulso per ciclo su collegamenti dormienti
    pulseMaxRate: 0.85,      // … e su collegamenti molto attivi
    pulseSpeedRange: [0.05, 0.14], // cicli al secondo
    pulseSize: 0.34,
    autoRotateSpeed: 0.1,    // deriva lentissima della visuale quando nessuno interagisce (0 = off)
    autoRotateResumeMs: 9000,
    introSeconds: 2.4,
    focusSeconds: 1.15,
  },

  /* ---------- Camera e controlli ---------- */
  camera: {
    fov: 50,
    initialDistance: 84,
    initialDirection: [0.5, 0.3, 1],
    minDistance: 3.5, maxDistance: 160, panLimit: 55,
    focusDistanceContent: 8.5, focusDistanceTopic: 16,
    dampingFactor: 0.075, zoomSpeed: 0.85, rotateSpeed: 0.55, panSpeed: 0.7,
    clickThresholdPx: 6, touchThresholdPx: 10,      // sotto questa soglia è un click, sopra un trascinamento
    pickRadiusMouse: 14, pickRadiusTouch: 30,       // area sensibile attorno ai nodi (pixel)
    focusOffset: 0.2, focusOffsetMobile: 0.4,       // sposta il nodo sopra il pannello di anteprima
    secretRevealDistance: 22,                       // le regioni "secret" mostrano l'etichetta solo da vicino
  },

  /* ---------- Qualità grafica ---------- */
  quality: {
    high: { dprMax: 2, filamentSegments: 16, pulsesPerEdge: 2, antialias: true },
    low: { dprMax: 1.25, filamentSegments: 8, pulsesPerEdge: 1, antialias: false },
  },
};
