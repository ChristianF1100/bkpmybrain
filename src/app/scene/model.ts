/** Modello di scena: dal grafo statico a array tipizzati pronti per la GPU. Nessuna dipendenza da three. */
import type { Graph, GraphEdge, GraphNode, NetworkConfig, Vec3 } from '../../core/types.ts';
import { buildAdjacency } from '../../core/activity.ts';
import type { Adjacency } from '../../core/activity.ts';
import { hashUnit } from '../../core/rng.ts';

export interface SceneModel {
  count: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  pos: Float32Array;       // N×3 coordinate stabili
  rgb: Float32Array;       // N×3
  size: Float32Array;      // raggio del wireframe (unità di scena)
  seed: Float32Array;      // [0,1) stabile per nodo (fase delle oscillazioni)
  presence: Float32Array;  // 1 = normale; <1 per regioni "faint" (CrestaNord)
  ts: Float64Array;        // millisecondi di pubblicazione (NaN per gli argomenti)
  adj: Adjacency;
  indexById: Map<string, number>;
  topicIdx: number[];
  center: Vec3;
  radius: number;
}

export function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function nodeSize(n: GraphNode, cfg: NetworkConfig['nodes']): number {
  if (n.kind === 'topic') return (cfg.topicBase + cfg.topicGrow * n.structural) * (1 - (n.faint ?? 0) * 0.35);
  const scale = cfg.typeScale[n.type as keyof typeof cfg.typeScale] ?? 1;
  return cfg.contentBase * scale * (0.9 + 0.35 * n.structural);
}

export function buildSceneModel(graph: Graph, cfg: NetworkConfig): SceneModel {
  const nodes = graph.nodes;
  const count = nodes.length;
  const pos = new Float32Array(count * 3), rgb = new Float32Array(count * 3);
  const size = new Float32Array(count), seed = new Float32Array(count), presence = new Float32Array(count).fill(1);
  const ts = new Float64Array(count).fill(NaN);
  const indexById = new Map<string, number>();
  const topicIdx: number[] = [];
  const topicFaint = new Map<string, number>();
  for (const n of nodes) if (n.kind === 'topic' && n.faint) topicFaint.set(n.ref, n.faint);

  nodes.forEach((n, i) => {
    indexById.set(n.id, i);
    pos.set(n.pos, i * 3);
    rgb.set(hexToRgb(n.color), i * 3);
    size[i] = nodeSize(n, cfg.nodes);
    seed[i] = hashUnit(`seed:${n.id}`);
    if (n.date) ts[i] = Date.parse(n.date);
    if (n.kind === 'topic') topicIdx.push(i);
    const faint = n.kind === 'topic' ? n.faint ?? 0 : topicFaint.get(n.topics[0]) ?? 0;
    presence[i] = 1 - faint * 0.8;
  });

  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < count; i++) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
  const center: Vec3 = count ? [cx / count, cy / count, cz / count] : [0, 0, 0];
  let radius = 1;
  for (let i = 0; i < count; i++) radius = Math.max(radius, Math.hypot(pos[i * 3] - center[0], pos[i * 3 + 1] - center[1], pos[i * 3 + 2] - center[2]));
  return { count, nodes, edges: graph.edges, pos, rgb, size, seed, presence, ts, adj: buildAdjacency(count, graph.edges), indexById, topicIdx, center, radius };
}

export const neighborsOf = (m: SceneModel, i: number): number[] => m.adj[i].map((e) => e.to);
