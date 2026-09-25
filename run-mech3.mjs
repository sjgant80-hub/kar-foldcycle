// kar-foldcycle · run-mech3.mjs — mechanism 3 measurement (deterministic, no model needed; it is a pool-
// POLICY question). A workload whose WORKING SET shifts over time: phase A small, phase B large, phase C
// small again. Content recurs within each phase. Three arms run the SAME seeded trace: a small fixed cap, a
// large fixed cap, and the adaptive balancer. We measure hit-rate (embedding calls avoided — each hit is a
// real ~44ms nomic-embed avoided, per mechanism 2) AND average memory held. The balancer earns its keep only
// if it holds the large cap's hit-rate at much less memory. Kar predicted this likely LEARNs — the eval settles it.
import { writeFileSync } from 'node:fs';
import createBalancedPool, { balanceVerdict } from './balancer.mjs';

// deterministic PRNG (seeded LCG) — no Math.random, so the trace is reproducible
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; }

// build a trace whose working set shifts: [W, folds] phases. Within a phase, draw keys from that phase's set.
function buildTrace() {
  const rnd = lcg(20260925);
  const phases = [{ W: 10, n: 80, tag: 'A' }, { W: 45, n: 200, tag: 'B' }, { W: 10, n: 80, tag: 'C' }];
  const trace = [];
  for (const p of phases) for (let i = 0; i < p.n; i++) trace.push(`${p.tag}:${Math.floor(rnd() * p.W)}`);
  return trace;
}

// run one pool through the trace: each fold allocates (reuse if pooled) else "computes" (a real embed would
// happen here — counted as a miss), then releases its capacity back (the fold expires between recurrences).
function runArm(pool, trace) {
  const V = [1]; // stand-in vector; the policy question is hit-rate/memory, not the vector's content
  for (const key of trace) {
    if (pool.allocate(key) === null) { /* miss = one real embedding call would be spent here */ }
    pool.release(key, V); // capacity released on this fold's expiry, available to a recurrence
  }
  return pool.stats();
}

const trace = buildTrace();
const fixedSmall = runArm(createBalancedPool({ minCap: 15, maxCap: 15 }), trace);   // sized for the small phases
const fixedLarge = runArm(createBalancedPool({ minCap: 50, maxCap: 50 }), trace);   // sized for the large phase (wasteful in small)
const adaptive  = runArm(createBalancedPool({ minCap: 8, maxCap: 60, grow: 6, decayEvery: 30 }), trace);

const pct = (x) => Math.round(x * 100);
console.log(`trace: ${trace.length} folds, working set shifts 10 → 45 → 10`);
console.log(`fixed-small (cap 15): hit-rate ${pct(fixedSmall.hitRate)}%  avg-mem ${fixedSmall.avgMem.toFixed(1)}`);
console.log(`fixed-large (cap 50): hit-rate ${pct(fixedLarge.hitRate)}%  avg-mem ${fixedLarge.avgMem.toFixed(1)}`);
console.log(`adaptive    (8..60):  hit-rate ${pct(adaptive.hitRate)}%  avg-mem ${adaptive.avgMem.toFixed(1)}  (final cap ${adaptive.cap}, regret ${adaptive.regret})`);

const verdict = balanceVerdict({ adaptive, fixedLarge, fixedSmall });
const round = (o) => ({ hitRate: +o.hitRate.toFixed(4), avgMem: +o.avgMem.toFixed(2), avgCap: +o.avgCap.toFixed(2), cap: o.cap, regret: o.regret, hits: o.hits, misses: o.misses });
const results = {
  what: 'fold-cycle mechanism 3 — the balance condition: an adaptive pool that self-tunes retention to a shifting working set, vs fixed caps. Deterministic pool-policy simulation.',
  metric: 'hit-rate (each hit = one real embedding call avoided, ~44ms per mechanism 2) AND average memory held, over a trace whose working set shifts 10 → 45 → 10.',
  trace: { folds: trace.length, phases: '10 → 45 → 10' },
  arms: { fixedSmall: round(fixedSmall), fixedLarge: round(fixedLarge), adaptive: round(adaptive) },
  verdict,
  honest: 'A pool-policy question, so measured deterministically (no model calls). Kar predicted LEARN: a fixed cap sized to the peak working set is often as good; the balancer earns its keep only if it holds the large cap hit-rate at much less memory. κ is the private lens, not the claim.',
};
writeFileSync(new URL('./results-mech3.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(`\n${verdict.verdict}: ${verdict.why}`);
console.log('wrote results-mech3.json');
