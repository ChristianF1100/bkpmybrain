import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../src/core/pipeline.ts';
import { buildSceneModel, hexToRgb } from '../src/app/scene/model.ts';
import { buildFilamentBuffers, buildPointBuffers, buildPulseBuffers, buildWireBuffers } from '../src/app/scene/buffers.ts';
import type { ShapePart } from '../src/app/scene/buffers.ts';
import { CFG, NOW, demoFiles, demoTopics } from './helpers.ts';

const { graph } = runPipeline({ files: demoFiles(), topics: demoTopics(), config: CFG, now: NOW });
const model = buildSceneModel(graph, CFG);
const tri = (): ShapePart[] => [{ segments: new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]), detail: 0 }, { segments: new Float32Array([0, 0, 1, 1, 0, 0]), detail: 1 }];
const finite = (a: Float32Array) => a.every((x) => Number.isFinite(x));

test('modello di scena: array coerenti con il grafo', () => {
  assert.equal(model.count, graph.nodes.length);
  assert.equal(model.pos.length, model.count * 3);
  assert.ok(finite(model.pos) && finite(model.size) && model.size.every((s) => s > 0));
  assert.deepEqual(hexToRgb('#ff8000').map((x) => Math.round(x * 255)), [255, 128, 0]);
  assert.equal(model.topicIdx.length, 9);
  const cn = model.indexById.get('c:crestanord')!;
  assert.ok(model.presence[cn] < 1, 'la regione CrestaNord è poco evidente');
  assert.equal(model.presence[model.indexById.get('t:fpv')!], 1);
});
test('buffer dei wireframe: un vertice per estremo di segmento, indici validi', () => {
  const b = buildWireBuffers(model, tri);
  assert.equal(b.vertexCount, model.count * 6);
  assert.ok(finite(b.aLocal) && finite(b.aCenter));
  for (let v = 0; v < b.vertexCount; v++) { assert.ok(b.aNode[v * 2] < model.count); assert.ok(b.aNode[v * 2 + 1] === 0 || b.aNode[v * 2 + 1] === 1); }
});
test('buffer dei filamenti e degli impulsi: dimensioni e determinismo', () => {
  const f = buildFilamentBuffers(model, 8);
  assert.equal(f.vertexCount, model.edges.length * 16);
  assert.ok(finite(f.aA) && finite(f.aN1) && finite(f.aE));
  const f2 = buildFilamentBuffers(model, 8);
  assert.deepEqual(f.aN1, f2.aN1);
  const p = buildPulseBuffers(model, 2, [0.05, 0.14]);
  assert.equal(p.vertexCount, model.edges.length * 2);
  assert.ok(p.aP.every((x) => Number.isFinite(x)));
  const pt = buildPointBuffers(model, CFG.nodes);
  assert.equal(pt.vertexCount, model.count * 2);
});
test('la curva di un arco non dipende dall\'ordine degli indici dei nodi', () => {
  const swapped = { ...model, edges: model.edges.map((e) => ({ ...e, a: e.b, b: e.a })) };
  assert.deepEqual(buildFilamentBuffers(model, 4).aN1, buildFilamentBuffers(swapped, 4).aN1);
});
