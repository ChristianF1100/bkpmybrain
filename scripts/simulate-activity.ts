/**
 * Simula l'attività neurale a date diverse (decadimento e riattivazione) sui dati correnti.
 *   npm run simulate                  oggi, +30, +90, +180, +365 giorni
 *   npm run simulate -- 2027-01-15    una data specifica
 */
import { generate } from './build-data.ts';
import { NETWORK } from '../config/network.ts';
import { DAY_MS, brightness, buildAdjacency, createActivityEngine } from '../src/core/activity.ts';

const out = generate({ quiet: true });
if (out.errors.length) process.exit(1);
const { nodes, edges } = out.graph;
const engine = createActivityEngine(buildAdjacency(nodes.length, edges), NETWORK.activity);
const ts = nodes.map((n) => (n.date ? Date.parse(n.date) : NaN));
const today = Date.now();
const arg = process.argv[2];
const dates = arg ? [Date.parse(arg)] : [0, 30, 90, 180, 365].map((d) => today + d * DAY_MS);

const topics = nodes.map((n, i) => ({ n, i })).filter((x) => x.n.kind === 'topic');
console.log(['argomento'.padEnd(18), ...dates.map((d) => new Date(d).toISOString().slice(0, 10).padStart(11))].join(' '));
const rows = dates.map((d) => engine.compute(ts, d));
for (const { n, i } of topics) {
  console.log([n.label.padEnd(18), ...rows.map((r) => `${(brightness(r[i], NETWORK.activity) * 100).toFixed(0)}%`.padStart(11))].join(' '));
}
