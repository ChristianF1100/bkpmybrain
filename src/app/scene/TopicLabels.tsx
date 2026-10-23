/** Etichette degli argomenti: elementi DOM posizionati dalla scena (pochi, aggiornati ogni due fotogrammi). */
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { NETWORK } from '../../../config/network.ts';
import type { SceneModel } from './model.ts';

export function LabelLayer({ model, labels }: { model: SceneModel; labels: MutableRefObject<(HTMLDivElement | null)[]> }) {
  return (
    <div className="topic-labels" aria-hidden="true">
      {model.topicIdx.map((i, k) => (
        <div key={model.nodes[i].id} ref={(el) => { labels.current[k] = el; }} className="topic-label" style={{ color: model.nodes[i].color }}>
          {model.nodes[i].label}
        </div>
      ))}
    </div>
  );
}

export function LabelDriver({ model, labels, selected }: { model: SceneModel; labels: MutableRefObject<(HTMLDivElement | null)[]>; selected: number | null }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const frame = useRef(0);
  const v = useRef(new Vector3());
  useFrame(() => {
    if (++frame.current % 2) return;
    model.topicIdx.forEach((i, k) => {
      const el = labels.current[k];
      if (!el) return;
      const n = model.nodes[i];
      v.current.set(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
      const dist = v.current.distanceTo(camera.position);
      v.current.project(camera);
      let op = v.current.z > 1 || v.current.z < -1 ? 0 : 1;
      if (n.secret && dist > NETWORK.camera.secretRevealDistance) op = 0;          // regione nascosta: si svela solo da vicino
      else if (selected !== null && selected !== i) op *= 0.25;
      else op *= Math.min(1, Math.max(0.3, 1.4 - dist / 160)) * model.presence[i];
      const x = (v.current.x * 0.5 + 0.5) * size.width, y = (-v.current.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, 0)`;
      el.style.opacity = op.toFixed(2);
    });
  });
  return null;
}
