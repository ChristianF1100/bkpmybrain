/** Camera e controlli: rotazione, zoom, pan (mouse + touch), inerzia, limiti e transizioni verso i nodi. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE, TOUCH, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { NETWORK } from '../../../config/network.ts';
import type { SceneModel } from './model.ts';
import type { FocusRequest, SceneApi, ViewState } from '../types.ts';

interface Tween { t: number; dur: number; fromP: Vector3; fromT: Vector3; toP: Vector3; toT: Vector3 }
const ease = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

interface Props {
  model: SceneModel;
  focus: FocusRequest | null;
  selected: number | null;
  initialView: ViewState | null;
  reducedMotion: boolean;
  apiRef: MutableRefObject<SceneApi | null>;
}

export function CameraRig({ model, focus, selected, initialView, reducedMotion, apiRef }: Props) {
  const C = NETWORK.camera, M = NETWORK.motion;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  // stato (non ref): gli effetti partono solo quando i controlli esistono davvero
  const [ctl, setCtl] = useState<ElementRef<typeof OrbitControls> | null>(null);
  const initialized = useRef(false);
  const tween = useRef<Tween | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const center = useMemo(() => new Vector3(...model.center), [model]);

  /** Visuale iniziale: l'intera rete inquadrata (più lontana in verticale su smartphone). */
  const home = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const fit = clamp(aspect * 1.15, 0.55, 1);
    const dist = clamp((C.initialDistance * Math.max(0.6, model.radius / 42)) / fit, C.minDistance, C.maxDistance * 0.92);
    const dir = new Vector3(...C.initialDirection).normalize();
    return { target: center.clone(), pos: center.clone().addScaledVector(dir, dist) };
  }, [model, size.width, size.height, center, C]);

  useEffect(() => {
    if (!ctl || initialized.current) return;
    initialized.current = true;
    if (initialView) { camera.position.set(...initialView.p); ctl.target.set(...initialView.t); }
    else { camera.position.copy(home.pos); ctl.target.copy(home.target); }
    camera.lookAt(ctl.target);
    ctl.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl]);

  useEffect(() => {
    apiRef.current = {
      getView: () => ({ p: camera.position.toArray() as ViewState['p'], t: (ctl?.target ?? center).toArray() as ViewState['t'] }),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, center, ctl]);

  // Rotazione automatica lentissima: si ferma a ogni interazione o selezione e riprende dopo una pausa.
  useEffect(() => {
    const c = ctl;
    if (!c) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canRotate = !reducedMotion && M.autoRotateSpeed > 0;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (selectedRef.current === null && canRotate) c.autoRotate = true; }, M.autoRotateResumeMs);
    };
    const onStart = () => { c.autoRotate = false; clearTimeout(timer); };
    c.autoRotate = false;
    c.addEventListener('start', onStart);
    c.addEventListener('end', arm);
    if (selected === null) arm();
    return () => { clearTimeout(timer); c.removeEventListener('start', onStart); c.removeEventListener('end', arm); };
  }, [ctl, selected, reducedMotion, M]);

  useEffect(() => {
    const c = ctl;
    if (!focus || !c) return;
    let toT: Vector3, toP: Vector3;
    if (focus.kind === 'home') {
      toT = home.target.clone(); toP = home.pos.clone();
    } else {
      const i = focus.idx;
      const node = new Vector3(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
      const base = model.nodes[i].kind === 'topic' ? C.focusDistanceTopic : C.focusDistanceContent;
      const dist = clamp(base * (0.85 + 0.15 * model.size[i]), C.minDistance * 1.2, C.maxDistance);
      const dir = camera.position.clone().sub(c.target);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      // il nodo appare sopra il centro dello schermo, così il pannello di anteprima non lo copre
      const offset = (window.innerWidth < 720 ? C.focusOffsetMobile : C.focusOffset) * dist * Math.tan((C.fov * Math.PI) / 360) * 2;
      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      toT = node.clone().addScaledVector(up, -offset);
      toP = toT.clone().addScaledVector(dir, dist);
    }
    if (focus.instant || reducedMotion) {
      camera.position.copy(toP); c.target.copy(toT); camera.lookAt(c.target); c.update();
      tween.current = null; c.enabled = true;
    } else {
      tween.current = { t: 0, dur: M.focusSeconds, fromP: camera.position.clone(), fromT: c.target.clone(), toP, toT };
      c.enabled = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq, ctl]);

  useFrame((_, dt) => {
    const c = ctl;
    if (!c) return;
    const tw = tween.current;
    if (tw) {
      tw.t += Math.min(dt, 0.05) / tw.dur;
      const k = ease(Math.min(1, tw.t));
      camera.position.lerpVectors(tw.fromP, tw.toP, k);
      c.target.lerpVectors(tw.fromT, tw.toT, k);
      camera.lookAt(c.target);
      if (tw.t >= 1) { tween.current = null; c.enabled = true; }
      return;
    }
    // limiti di navigazione: il bersaglio non esce dalla sfera di pan (la camera segue)
    const off = c.target.clone().sub(center);
    const l = off.length();
    if (l > C.panLimit) {
      const delta = off.multiplyScalar(C.panLimit / l).add(center).sub(c.target);
      c.target.add(delta); camera.position.add(delta);
    }
  });

  return (
    <OrbitControls
      ref={setCtl}
      makeDefault
      enableDamping
      dampingFactor={C.dampingFactor}
      rotateSpeed={C.rotateSpeed}
      zoomSpeed={C.zoomSpeed}
      panSpeed={C.panSpeed}
      zoomToCursor
      screenSpacePanning
      minDistance={C.minDistance}
      maxDistance={C.maxDistance}
      autoRotateSpeed={M.autoRotateSpeed}
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.PAN }} // Maiusc + sinistro = pan (comportamento integrato)
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
    />
  );
}
