/**
 * Modello dati condiviso tra build (script Node) e browser.
 * Questo file contiene SOLO tipi e piccole costanti: nessuna dipendenza.
 */
export type Vec3 = [number, number, number];

export const CONTENT_TYPES = [
  'article', 'note', 'fragment', 'project', 'photo', 'video', 'code', 'memory', 'mixed',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const TYPE_LABELS: Record<ContentType, string> = {
  article: 'Articolo', note: 'Appunto', fragment: 'Frammento', project: 'Progetto',
  photo: 'Fotografia', video: 'Video', code: 'Codice', memory: 'Memoria', mixed: 'Contenuto misto',
};

/** Alias italiani accettati nel frontmatter (`type: nota`). */
export const TYPE_ALIASES: Record<string, ContentType> = {
  articolo: 'article', nota: 'note', appunto: 'note', appunti: 'note', frammento: 'fragment',
  pensiero: 'fragment', progetto: 'project', foto: 'photo', fotografia: 'photo',
  codice: 'code', memoria: 'memory', misto: 'mixed',
};

export type Zone = 'core' | 'mid' | 'branch' | 'remote';

export interface RawContent { file: string; source: string }

export interface ContentItem {
  id: string;
  slug: string;
  type: ContentType;
  title: string | null;
  /** ISO 8601 UTC */
  date: string;
  description: string;
  tags: string[];
  related: string[];
  primary: string | null;
  cover: { src: string; alt: string } | null;
  demo: boolean;
  file: string;
  /** Testo semplice per la ricerca (titolo + descrizione + corpo). */
  text: string;
  url: string;
}

export interface TopicDef {
  id: string;
  label: string;
  color: string;
  description?: string;
  aliases?: string[];
  zone?: Zone;
  position?: Vec3;
  related?: { topic: string; weight?: number }[];
  /** Regione nascosta: l'etichetta compare solo avvicinandosi. */
  secret?: boolean;
  /** 0..1: riduce la presenza visiva del nodo (regioni quasi dormienti). */
  faint?: number;
}
export interface Topic extends TopicDef { auto?: boolean }

export type LinkKind = 'topic-content' | 'content-content' | 'topic-topic' | 'explicit';
export interface Link { a: string; b: string; w: number; kind: LinkKind }

export interface GraphNode {
  id: string;            // 't:fpv' | 'c:<id>'
  kind: 'topic' | 'content';
  ref: string;           // id del topic o del contenuto
  label: string;
  type: ContentType | 'topic';
  date: string | null;
  pos: Vec3;
  color: string;
  topics: string[];      // id dei topic (principale per primo)
  titled: boolean;
  desc: string;
  url: string | null;
  structural: number;    // 0..1 — forza strutturale
  secret?: boolean;
  faint?: number;
}
export interface GraphEdge { a: number; b: number; w: number; kind: LinkKind }
export interface Graph { version: 1; generated: string; nodes: GraphNode[]; edges: GraphEdge[] }

/* ---------- Parametri (valori in config/network.ts) ---------- */

export interface ActivityParams {
  minBrightness: number;     // luminosità minima (0.08)
  halfLifeDays: number;      // tempo di dimezzamento (30)
  strongLinkPass: number;    // quota propagata da un collegamento forte (0.55)
  maxHops: number;           // passaggi massimi di propagazione (3)
  maxActivity: number;       // attività massima (1)
  weightExponent: number;    // quanto il peso del collegamento incide sulla propagazione
  cutoffHalfLives: number;   // oltre N emivite l'impulso è trascurato
  minPropagated: number;     // soglia sotto cui la propagazione si ferma
}
export interface StructuralParams { topicScale: number; contentScale: number }
export interface LinkParams {
  topicTagWeight: number; minorTagWeight: number; strengthGain: number; minStrength: number;
  maxSecondaryLinks: number; maxTagFanout: number; explicitWeight: number;
  topicLinkDecay: number; topicLinkFloor: number; maxTopicsPerContent: number;
  topicCoocGain: number; topicMinStrength: number; maxTopicLinks: number;
  autoTopicMinCount: number;
  /** Gruppi di tag equivalenti: il primo è quello canonico. */
  equivalences: string[][];
}
export interface LayoutParams {
  radius: number;
  zoneRanges: Record<Zone, [number, number]>;
  minAnchorDistance: number;
  cloudRadius: number; cloudMinFraction: number; branchStretch: number;
  minNodeDistance: number; topicClearance: number; attempts: number;
  secondaryWeights: number[]; decimals: number;
}
export interface NodeStyleParams {
  topicBase: number; topicGrow: number; contentBase: number;
  typeScale: Record<ContentType, number>;
  coreSize: number; haloSize: number;
}
export interface LightingParams {
  lineMin: number; lineMax: number; filMin: number; filMax: number;
  haloStrength: number; coreStrength: number; fogNear: number; fogFar: number;
  detailNear: number; detailFar: number; dimOthers: number; dimNeighbors: number;
}
export interface MotionParams {
  wobbleAmplitude: number; filamentSway: number; timeScale: number; spinSpeed: number;
  pulseMinRate: number; pulseMaxRate: number; pulseSpeedRange: [number, number]; pulseSize: number;
  autoRotateSpeed: number; autoRotateResumeMs: number; introSeconds: number; focusSeconds: number;
}
export interface CameraParams {
  fov: number; initialDistance: number; initialDirection: Vec3;
  minDistance: number; maxDistance: number; panLimit: number;
  focusDistanceContent: number; focusDistanceTopic: number;
  dampingFactor: number; zoomSpeed: number; rotateSpeed: number; panSpeed: number;
  clickThresholdPx: number; touchThresholdPx: number; pickRadiusMouse: number; pickRadiusTouch: number;
  focusOffset: number; focusOffsetMobile: number; secretRevealDistance: number;
}
export interface QualityTier {
  dprMax: number; filamentSegments: number; pulsesPerEdge: number; antialias: boolean;
}
export interface NetworkConfig {
  palette: { background: string; neutral: string; autoColors: string[] };
  activity: ActivityParams;
  structural: StructuralParams;
  links: LinkParams;
  layout: LayoutParams;
  nodes: NodeStyleParams;
  lighting: LightingParams;
  motion: MotionParams;
  camera: CameraParams;
  quality: { high: QualityTier; low: QualityTier };
}
