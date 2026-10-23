/** Curve dei filamenti: punti di controllo deterministici (stabili tra un caricamento e l'altro). */
import type { Vec3 } from './types.ts';
import { randomUnitVector, rngFor } from './rng.ts';

export interface Controls { n1: Vec3; n2: Vec3 }

/** Offset dei due punti di controllo di una Bézier cubica da A a B (A = id minore). */
export function curveControls(idA: string, idB: string, A: Vec3, B: Vec3): Controls {
  const rng = rngFor(`curve:${idA}|${idB}`);
  const d: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const L = Math.hypot(...d) || 1;
  const u: Vec3 = [d[0] / L, d[1] / L, d[2] / L];
  let perp: Vec3 = [0, 0, 0];
  for (let tries = 0; tries < 4; tries++) {
    const r = randomUnitVector(rng);
    const c: Vec3 = [u[1] * r[2] - u[2] * r[1], u[2] * r[0] - u[0] * r[2], u[0] * r[1] - u[1] * r[0]];
    const m = Math.hypot(...c);
    if (m > 0.2) { perp = [c[0] / m, c[1] / m, c[2] / m]; break; }
  }
  const k1 = L * (0.08 + 0.16 * rng());
  const k2 = L * (rng() * 0.24 - 0.12);
  return {
    n1: [perp[0] * k1, perp[1] * k1, perp[2] * k1],
    n2: [perp[0] * k2, perp[1] * k2, perp[2] * k2],
  };
}
