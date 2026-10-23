/** Forme wireframe per tipologia. Tutte costruite con linee sottili (EdgesGeometry), mai sfere piene. */
import {
  BoxGeometry, CylinderGeometry, DodecahedronGeometry, EdgesGeometry, IcosahedronGeometry,
  OctahedronGeometry, TetrahedronGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ShapeLookup, ShapePart } from './buffers.ts';

type Maker = () => BufferGeometry;
interface PartDef { make: Maker; scale?: number; rot?: [number, number, number]; detail: 0 | 1 }

const SHAPES: Record<string, PartDef[]> = {
  // argomenti: strutture più grandi e complesse (icosaedro suddiviso + nucleo interno + guscio intermedio)
  topic: [
    { make: () => new IcosahedronGeometry(1, 1), detail: 0 },
    { make: () => new IcosahedronGeometry(0.62, 0), rot: [0.5, 0.3, 0], detail: 1 },
    { make: () => new OctahedronGeometry(0.32, 0), rot: [0.2, 0.8, 0.4], detail: 1 },
  ],
  article: [{ make: () => new DodecahedronGeometry(1, 0), detail: 0 }],
  note: [{ make: () => new OctahedronGeometry(1, 0), detail: 0 }],
  fragment: [{ make: () => new TetrahedronGeometry(1, 0), detail: 0 }],
  project: [
    { make: () => new BoxGeometry(1.5, 1.5, 1.5), detail: 0 },
    { make: () => new IcosahedronGeometry(0.7, 0), rot: [0.4, 0.4, 0], detail: 1 },
  ],
  photo: [{ make: () => new BoxGeometry(1.6, 1.1, 0.22), detail: 0 }],
  video: [{ make: () => new CylinderGeometry(0.95, 0.95, 0.8, 3), rot: [Math.PI / 2, 0, 0], detail: 0 }],
  code: [{ make: () => new CylinderGeometry(0.85, 0.85, 1.15, 6), detail: 0 }],
  memory: [
    { make: () => new OctahedronGeometry(1, 0), detail: 0 },
    { make: () => new OctahedronGeometry(0.5, 0), rot: [0, Math.PI / 4, 0], detail: 1 },
  ],
  mixed: [{ make: () => new IcosahedronGeometry(1, 0), detail: 0 }],
};

const cache = new Map<string, ShapePart[]>();

export const shapeLookup: ShapeLookup = (key) => {
  let parts = cache.get(key);
  if (parts) return parts;
  parts = (SHAPES[key] ?? SHAPES.mixed).map((def) => {
    const g = def.make();
    if (def.rot) { g.rotateX(def.rot[0]); g.rotateY(def.rot[1]); g.rotateZ(def.rot[2]); }
    const edges = new EdgesGeometry(g, 1);
    const arr = Float32Array.from(edges.getAttribute('position').array as ArrayLike<number>);
    // normalizza al raggio unitario (il box e i prismi non lo sono)
    let r = 0;
    for (let i = 0; i < arr.length; i += 3) r = Math.max(r, Math.hypot(arr[i], arr[i + 1], arr[i + 2]));
    const k = r > 0 ? (def.scale ?? 1) / Math.max(r, 1) : 1;
    for (let i = 0; i < arr.length; i++) arr[i] *= k;
    g.dispose(); edges.dispose();
    return { segments: arr, detail: def.detail } as ShapePart;
  });
  cache.set(key, parts);
  return parts;
};
