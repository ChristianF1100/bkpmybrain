/** Scena 3D: 4 draw call (wireframe, nuclei+aloni, filamenti, impulsi) + camera + selezione + etichette. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { NETWORK } from '../../../config/network.ts';
import type { Tier } from '../quality.ts';
import type { FocusRequest, HoverInfo, SceneApi, ViewState } from '../types.ts';
import type { SceneModel } from './model.ts';
import { neighborsOf } from './model.ts';
import { buildFilamentBuffers, buildPointBuffers, buildPulseBuffers, buildWireBuffers } from './buffers.ts';
import { shapeLookup } from './shapes.ts';
import { SceneRuntime } from './runtime.ts';
import * as S from './shaders.ts';
import { CameraRig } from './CameraRig.tsx';
import { Picker } from './Picker.tsx';
import { LabelDriver, LabelLayer } from './TopicLabels.tsx';

type Attrs = Record<string, [Float32Array, number]>;

function makeGeometry(attrs: Attrs, positionFrom: string, count: number): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, [arr, size]] of Object.entries(attrs)) g.setAttribute(name, new BufferAttribute(arr, size));
  g.setAttribute('position', new BufferAttribute(attrs[positionFrom][0], 3)); // three richiede 'position' per il conteggio dei vertici
  g.setDrawRange(0, count);
  return g;
}

function makeMaterial(runtime: SceneRuntime, vertexShader: string, fragmentShader: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: runtime.uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  });
}

function Network({ model, runtime, tier, pulses }: { model: SceneModel; runtime: SceneRuntime; tier: Tier; pulses: boolean }) {
  const q = NETWORK.quality[tier];
  const parts = useMemo(() => {
    const w = buildWireBuffers(model, shapeLookup);
    const p = buildPointBuffers(model, NETWORK.nodes);
    const f = buildFilamentBuffers(model, q.filamentSegments);
    const wire = makeGeometry({ aLocal: [w.aLocal, 3], aCenter: [w.aCenter, 3], aNode: [w.aNode, 2] }, 'aCenter', w.vertexCount);
    const points = makeGeometry({ aCenter: [p.aCenter, 3], aInfo: [p.aInfo, 3] }, 'aCenter', p.vertexCount);
    const fil = makeGeometry({ aT: [f.aT, 1], aA: [f.aA, 3], aB: [f.aB, 3], aN1: [f.aN1, 3], aN2: [f.aN2, 3], aE: [f.aE, 4] }, 'aA', f.vertexCount);
    let pulse: BufferGeometry | null = null;
    if (pulses && model.edges.length) {
      const u = buildPulseBuffers(model, q.pulsesPerEdge, NETWORK.motion.pulseSpeedRange);
      pulse = makeGeometry({ aA: [u.aA, 3], aB: [u.aB, 3], aN1: [u.aN1, 3], aN2: [u.aN2, 3], aE: [u.aE, 4], aP: [u.aP, 3] }, 'aA', u.vertexCount);
    }
    return {
      wire, points, fil, pulse,
      mats: {
        wire: makeMaterial(runtime, S.WIRE_VERT, S.WIRE_FRAG), points: makeMaterial(runtime, S.POINT_VERT, S.POINT_FRAG),
        fil: makeMaterial(runtime, S.FIL_VERT, S.FIL_FRAG), pulse: makeMaterial(runtime, S.PULSE_VERT, S.PULSE_FRAG),
      },
    };
  }, [model, runtime, q.filamentSegments, q.pulsesPerEdge, pulses]);

  useEffect(() => () => {
    parts.wire.dispose(); parts.points.dispose(); parts.fil.dispose(); parts.pulse?.dispose();
    Object.values(parts.mats).forEach((m) => m.dispose());
  }, [parts]);

  return (
    <>
      <lineSegments geometry={parts.fil} material={parts.mats.fil} frustumCulled={false} renderOrder={1} />
      <lineSegments geometry={parts.wire} material={parts.mats.wire} frustumCulled={false} renderOrder={2} />
      <points geometry={parts.points} material={parts.mats.points} frustumCulled={false} renderOrder={3} />
      {parts.pulse && <points geometry={parts.pulse} material={parts.mats.pulse} frustumCulled={false} renderOrder={4} />}
    </>
  );
}

/** Aggiorna il runtime GPU una volta per fotogramma (solo uniform e, se serve, la piccola texture di stato). */
function RuntimeDriver({ runtime }: { runtime: SceneRuntime }) {
  useFrame((state, dt) => {
    runtime.setPointScale((state.size.height * state.gl.getPixelRatio()) / (2 * Math.tan((NETWORK.camera.fov * Math.PI) / 360)));
    runtime.update(Math.min(dt, 0.1));
  });
  return null;
}

export interface NetworkCanvasProps {
  model: SceneModel;
  activity: Float32Array;
  selected: number | null;
  focus: FocusRequest | null;
  initialView: ViewState | null;
  reducedMotion: boolean;
  tier: Tier;
  apiRef: MutableRefObject<SceneApi | null>;
  onPick: (idx: number | null) => void;
  onHover: (h: HoverInfo | null) => void;
}

export default function NetworkCanvas(p: NetworkCanvasProps) {
  const q = NETWORK.quality[p.tier];
  const [dpr, setDpr] = useState(Math.min(q.dprMax, window.devicePixelRatio || 1));
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const runtime = useMemo(() => new SceneRuntime(p.model, NETWORK, p.reducedMotion), [p.model, p.reducedMotion]);
  useEffect(() => () => runtime.dispose(), [runtime]);

  useEffect(() => { runtime.setActivity(p.activity); }, [runtime, p.activity]);
  useEffect(() => {
    runtime.setFocus(p.selected ?? -1, p.selected !== null ? neighborsOf(p.model, p.selected) : []);
  }, [runtime, p.model, p.selected]);
  useEffect(() => { if (p.focus?.flash && p.focus.kind === 'node') runtime.flash(p.focus.idx); }, [runtime, p.focus?.seq]);

  return (
    <div className="network">
      <Canvas
        dpr={dpr}
        camera={{ fov: NETWORK.camera.fov, near: 0.1, far: 800, position: [0, 0, NETWORK.camera.initialDistance] }}
        gl={{ antialias: q.antialias, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        aria-label="Rete neurale tridimensionale dei contenuti"
      >
        {/* se il dispositivo fatica, scende prima la risoluzione */}
        <PerformanceMonitor flipflops={3} onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} onIncline={() => setDpr(Math.min(q.dprMax, window.devicePixelRatio || 1))} />
        <RuntimeDriver runtime={runtime} />
        <Network model={p.model} runtime={runtime} tier={p.tier} pulses={!p.reducedMotion} />
        <CameraRig model={p.model} focus={p.focus} selected={p.selected} initialView={p.initialView} reducedMotion={p.reducedMotion} apiRef={p.apiRef} />
        <Picker model={p.model} runtime={runtime} onPick={p.onPick} onHover={p.onHover} />
        <LabelDriver model={p.model} labels={labels} selected={p.selected} />
      </Canvas>
      <LabelLayer model={p.model} labels={labels} />
    </div>
  );
}
