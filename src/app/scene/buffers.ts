/**
 * Costruzione degli array per i buffer GPU. Funzioni pure (niente three): testabili in Node.
 * Tutta la rete usa 4 draw call: wireframe dei nodi, nuclei+aloni, filamenti, impulsi.
 */
import type { NetworkConfig } from '../../core/types.ts';
import { curveControls } from '../../core/curves.ts';
import { hashUnit } from '../../core/rng.ts';
import type { SceneModel } from './model.ts';

export interface ShapePart { segments: Float32Array; detail: 0 | 1 }
export type ShapeLookup = (key: string) => ShapePart[];

export function shapeKey(type: string): string { return type; }

function orient(x: number, y: number, z: number, yaw: number, pitch: number): [number, number, number] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
  return [x1, cp * y - sp * z1, sp * y + cp * z1];
}

export function buildWireBuffers(model: SceneModel, shapes: ShapeLookup) {
  const perNode = model.nodes.map((n) => shapes(shapeKey(n.type)));
  let total = 0;
  for (const parts of perNode) for (const p of parts) total += p.segments.length / 3;
  const aLocal = new Float32Array(total * 3), aCenter = new Float32Array(total * 3), aNode = new Float32Array(total * 2);
  let v = 0;
  perNode.forEach((parts, i) => {
    const id = model.nodes[i].id;
    const yaw = hashUnit(`${id}:yaw`) * Math.PI * 2, pitch = hashUnit(`${id}:pitch`) * Math.PI * 2;
    const s = model.size[i];
    for (const part of parts) {
      for (let k = 0; k < part.segments.length; k += 3) {
        const [x, y, z] = orient(part.segments[k] * s, part.segments[k + 1] * s, part.segments[k + 2] * s, yaw, pitch);
        aLocal.set([x, y, z], v * 3);
        aCenter.set([model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]], v * 3);
        aNode[v * 2] = i; aNode[v * 2 + 1] = part.detail;
        v++;
      }
    }
  });
  return { aLocal, aCenter, aNode, vertexCount: total };
}

/** Per ogni nodo due punti: nucleo luminoso (kind 0) e alone soffuso (kind 1). */
export function buildPointBuffers(model: SceneModel, cfg: NetworkConfig['nodes']) {
  const n = model.count;
  const aCenter = new Float32Array(n * 6), aInfo = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const c = [model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]];
    const s = model.size[i];
    aCenter.set(c, i * 6); aCenter.set(c, i * 6 + 3);
    aInfo.set([i, 0, cfg.coreSize * (0.6 + 0.4 * s)], i * 6);
    aInfo.set([i, 1, cfg.haloSize * Math.pow(s, 0.9)], i * 6 + 3);
  }
  return { aCenter, aInfo, vertexCount: n * 2 };
}

function edgeGeometry(model: SceneModel, e: { a: number; b: number; w: number }) {
  const ia = model.nodes[e.a].id < model.nodes[e.b].id ? e.a : e.b; // ordine per id: curva stabile
  const ib = ia === e.a ? e.b : e.a;
  const A: [number, number, number] = [model.pos[ia * 3], model.pos[ia * 3 + 1], model.pos[ia * 3 + 2]];
  const B: [number, number, number] = [model.pos[ib * 3], model.pos[ib * 3 + 1], model.pos[ib * 3 + 2]];
  const c = curveControls(model.nodes[ia].id, model.nodes[ib].id, A, B);
  const seed = hashUnit(`edge:${model.nodes[ia].id}|${model.nodes[ib].id}`);
  return { ia, ib, A, B, n1: c.n1, n2: c.n2, E: [ia, ib, e.w, seed] as [number, number, number, number], seed };
}

export function buildFilamentBuffers(model: SceneModel, segments: number) {
  const verts = model.edges.length * segments * 2;
  const aT = new Float32Array(verts), aA = new Float32Array(verts * 3), aB = new Float32Array(verts * 3);
  const aN1 = new Float32Array(verts * 3), aN2 = new Float32Array(verts * 3), aE = new Float32Array(verts * 4);
  let v = 0;
  for (const e of model.edges) {
    const g = edgeGeometry(model, e);
    for (let s = 0; s < segments; s++) {
      for (const t of [s / segments, (s + 1) / segments]) {
        aT[v] = t; aA.set(g.A, v * 3); aB.set(g.B, v * 3); aN1.set(g.n1, v * 3); aN2.set(g.n2, v * 3); aE.set(g.E, v * 4);
        v++;
      }
    }
  }
  return { aT, aA, aB, aN1, aN2, aE, vertexCount: verts };
}

export function buildPulseBuffers(model: SceneModel, perEdge: number, speed: [number, number]) {
  const n = model.edges.length * perEdge;
  const aA = new Float32Array(n * 3), aB = new Float32Array(n * 3), aN1 = new Float32Array(n * 3), aN2 = new Float32Array(n * 3);
  const aE = new Float32Array(n * 4), aP = new Float32Array(n * 3);
  let v = 0;
  for (const e of model.edges) {
    const g = edgeGeometry(model, e);
    for (let k = 0; k < perEdge; k++) {
      aA.set(g.A, v * 3); aB.set(g.B, v * 3); aN1.set(g.n1, v * 3); aN2.set(g.n2, v * 3); aE.set(g.E, v * 4);
      const key = `${model.nodes[g.ia].id}|${model.nodes[g.ib].id}:${k}`;
      aP.set([hashUnit(`${key}:phase`), speed[0] + (speed[1] - speed[0]) * hashUnit(`${key}:speed`), hashUnit(`${key}:dir`) > 0.5 ? 1 : 0], v * 3);
      v++;
    }
  }
  return { aA, aB, aN1, aN2, aE, aP, vertexCount: n };
}
