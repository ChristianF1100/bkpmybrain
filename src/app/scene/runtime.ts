/**
 * Stato dinamico della scena condiviso dai 4 materiali: una DataTexture (RGBA float, N×2) + uniform.
 * Qui vivono luminosità (da attività), attenuazione del focus, evidenziazione (hover/selezione/ricerca).
 * Aggiorna la texture SOLO quando qualcosa cambia.
 */
import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three';
import type { IUniform } from 'three';
import type { NetworkConfig } from '../../core/types.ts';
import { brightness } from '../../core/activity.ts';
import type { SceneModel } from './model.ts';

export class SceneRuntime {
  readonly count: number;
  readonly tex: DataTexture;
  readonly uniforms: Record<string, IUniform>;
  private data: Float32Array;
  private dimTarget: Float32Array;
  private dimCur: Float32Array;
  private hi: Float32Array;
  private hoverIdx = -1;
  private selIdx = -1;
  private flashIdx = -1;
  private flashT = 0;
  private elapsed = 0;
  private intro = 0;
  private dirty = true;
  private animating = true;

  constructor(private model: SceneModel, private cfg: NetworkConfig, private reducedMotion: boolean) {
    const n = Math.max(1, model.count);
    this.count = n;
    this.data = new Float32Array(n * 8);
    this.dimTarget = new Float32Array(n); this.dimCur = new Float32Array(n); this.hi = new Float32Array(n);
    for (let i = 0; i < model.count; i++) {
      this.dimTarget[i] = this.dimCur[i] = model.presence[i];
      const o = (n + i) * 4; // riga 1: dati statici
      this.data[o] = model.seed[i];
      this.data.set([model.rgb[i * 3], model.rgb[i * 3 + 1], model.rgb[i * 3 + 2]], o + 1);
      this.data[i * 4] = cfg.activity.minBrightness;
      this.data[i * 4 + 1] = this.dimCur[i];
    }
    this.tex = new DataTexture(this.data, n, 2, RGBAFormat, FloatType);
    this.tex.minFilter = this.tex.magFilter = NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;

    const L = cfg.lighting, M = cfg.motion;
    this.uniforms = {
      uState: { value: this.tex }, uCount: { value: n }, uTime: { value: 0 }, uIntro: { value: 0 },
      uAmp: { value: reducedMotion ? 0 : M.wobbleAmplitude }, uSway: { value: reducedMotion ? 0 : M.filamentSway },
      uSpin: { value: reducedMotion ? 0 : M.spinSpeed },
      uLineMin: { value: L.lineMin }, uLineMax: { value: L.lineMax }, uFilMin: { value: L.filMin }, uFilMax: { value: L.filMax },
      uFogNear: { value: L.fogNear }, uFogFar: { value: L.fogFar }, uDetailNear: { value: L.detailNear }, uDetailFar: { value: L.detailFar },
      uCore: { value: L.coreStrength }, uHalo: { value: L.haloStrength }, uPointScale: { value: 800 },
      uPulseMin: { value: M.pulseMinRate }, uPulseMax: { value: M.pulseMaxRate }, uPulseSize: { value: M.pulseSize },
      uMinB: { value: cfg.activity.minBrightness },
    };
    if (reducedMotion) this.intro = 1;
  }

  /** Attività (0..max) per nodo → luminosità visiva (8%..100%). */
  setActivity(activity: Float32Array): void {
    for (let i = 0; i < this.model.count; i++) this.data[i * 4] = brightness(activity[i], this.cfg.activity);
    this.dirty = true;
  }

  /** Porta un nodo in primo piano: il resto della rete si attenua. -1 ripristina. */
  setFocus(sel: number, neighbors: number[]): void {
    this.selIdx = sel;
    const L = this.cfg.lighting;
    const nb = new Set(neighbors);
    for (let i = 0; i < this.model.count; i++) {
      const base = this.model.presence[i];
      this.dimTarget[i] = sel < 0 ? base : i === sel ? 1 : nb.has(i) ? L.dimNeighbors * Math.max(base, 0.5) : L.dimOthers * base;
    }
    this.animating = true;
  }
  setHover(i: number): void { if (i !== this.hoverIdx) { this.hoverIdx = i; this.animating = true; } }
  flash(i: number): void { this.flashIdx = i; this.flashT = 1; this.animating = true; }

  setPointScale(v: number): void { this.uniforms.uPointScale.value = v; }

  update(dt: number): void {
    if (!this.reducedMotion) this.elapsed += dt * this.cfg.motion.timeScale;
    this.uniforms.uTime.value = this.elapsed;
    if (this.intro < 1) { this.intro = Math.min(1, this.intro + dt / this.cfg.motion.introSeconds); const e = 1 - Math.pow(1 - this.intro, 3); this.uniforms.uIntro.value = e; }
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt / 2.6);
    if (this.animating || this.flashT > 0) {
      const k = 1 - Math.exp(-dt * 5);
      let moving = false;
      const n = this.model.count;
      for (let i = 0; i < n; i++) {
        const d = this.dimTarget[i] - this.dimCur[i];
        if (Math.abs(d) > 0.002) { this.dimCur[i] += d * k; moving = true; } else this.dimCur[i] = this.dimTarget[i];
        const h = (i === this.hoverIdx ? 0.55 : 0) + (i === this.selIdx ? 0.35 : 0) + (i === this.flashIdx ? this.flashT : 0);
        this.data[i * 4 + 1] = this.dimCur[i];
        this.data[i * 4 + 2] = h;
      }
      this.dirty = true;
      this.animating = moving || this.hoverIdx >= 0 || this.flashT > 0;
    }
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
  }

  dispose(): void { this.tex.dispose(); }
}
