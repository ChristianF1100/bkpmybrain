/**
 * Selezione dei nodi nello spazio schermo (più affidabile del raycasting su linee sottili).
 * Distingue click da trascinamento con una soglia di movimento e ignora i gesti a più dita.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { NETWORK } from '../../../config/network.ts';
import type { SceneModel } from './model.ts';
import type { SceneRuntime } from './runtime.ts';
import type { HoverInfo } from '../types.ts';

interface Props {
  model: SceneModel;
  runtime: SceneRuntime;
  onPick: (idx: number | null) => void;
  onHover: (h: HoverInfo | null) => void;
}

export function Picker({ model, runtime, onPick, onHover }: Props) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const C = NETWORK.camera;
    const v = new Vector3();
    const fovK = 1 / (2 * Math.tan((C.fov * Math.PI) / 360));

    /** Nodo più vicino al puntatore entro il raggio sensibile (più ampio al tocco). */
    const pick = (clientX: number, clientY: number, touch: boolean): number => {
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left, py = clientY - rect.top;
      const base = touch ? C.pickRadiusTouch : C.pickRadiusMouse;
      let best = -1, bestScore = Infinity;
      for (let i = 0; i < model.count; i++) {
        v.set(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
        const dist = v.distanceTo(camera.position);
        v.project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const rpx = (model.size[i] * rect.height * fovK) / Math.max(dist, 0.1);
        const d = Math.hypot(sx - px, sy - py);
        if (d > base + rpx) continue;
        const score = d - Math.min(rpx, 40) * 0.6 + v.z * 4; // a parità, vince il nodo davanti
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return best;
    };

    const active = new Set<number>();
    let multi = false;
    let down: { x: number; y: number; id: number; touch: boolean; button: number; shift: boolean } | null = null;
    let raf = 0, lastHover = -1;

    const onDown = (e: PointerEvent) => {
      active.add(e.pointerId);
      if (active.size > 1) { multi = true; down = null; return; }
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', button: e.button, shift: e.shiftKey };
      if (lastHover !== -1) { lastHover = -1; runtime.setHover(-1); onHover(null); }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.buttons !== 0 || raf) return;
      const { clientX, clientY } = e;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const i = pick(clientX, clientY, false);
        if (i !== lastHover) {
          lastHover = i;
          runtime.setHover(i);
          el.style.cursor = i >= 0 ? 'pointer' : '';
          onHover(i >= 0 ? { idx: i, x: clientX, y: clientY } : null);
        }
      });
    };
    const onUp = (e: PointerEvent) => {
      active.delete(e.pointerId);
      const d = down;
      if (active.size === 0) { const wasMulti = multi; multi = false; if (wasMulti) { down = null; return; } }
      if (!d || d.id !== e.pointerId || multi) return;
      down = null;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      const limit = d.touch ? C.touchThresholdPx : C.clickThresholdPx;
      if (moved > limit || (d.button !== 0 && !d.touch) || d.shift) return; // trascinamento, tasto non primario o pan
      const i = pick(e.clientX, e.clientY, d.touch);
      onPick(i >= 0 ? i : null);
    };
    const onCancel = (e: PointerEvent) => { active.delete(e.pointerId); if (active.size === 0) multi = false; down = null; };
    const onLeave = () => { if (lastHover !== -1) { lastHover = -1; runtime.setHover(-1); onHover(null); el.style.cursor = ''; } };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.style.cursor = '';
    };
  }, [gl, camera, model, runtime, onPick, onHover]);

  return null;
}
