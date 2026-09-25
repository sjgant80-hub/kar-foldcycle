// kar-foldcycle · run-mech2.mjs — mechanism 2 measurement. A workload where folds EXPIRE and their content
// RECURS (a working set cycles). ON: on expiry release the embedding to the pool; on a recurring fold reuse
// it instead of recomputing. OFF: always recompute. CONTROL: all-unique content (nothing recurs). We embed
// with a REAL model (nomic-embed-text via Ollama) so the recycled computation is genuinely expensive, and
// count the embedding CALLS avoided + the TIME saved. The verdict is the SAME gated kernel the page uses.
//
//   node run-mech2.mjs                      # default nomic-embed-text, working set 15, 3 passes
import { writeFileSync } from 'node:fs';
import createPool, { onExpire, poolVerdict } from './capacitypool.mjs';

const MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const K = +(process.env.WORKING_SET || 15);   // distinct facts in the working set
const PASSES = +(process.env.PASSES || 3);     // how many times the set cycles (recurrence)

async function embedReal(text) {
  const t = Date.now();
  const r = await fetch(`${HOST}/api/embeddings`, { method: 'POST', body: JSON.stringify({ model: MODEL, prompt: text }) });
  const j = await r.json();
  return { ms: Date.now() - t, vector: j.embedding || [] };
}

// a deterministic working set of distinct facts
const FACT = (i) => `estate fact ${i}: organ ${i % 7} gated at threshold ${(i * 37) % 100} on shelf ${i % 5}, witnessed ${i}`;

// RECURRING workload: PASSES cycles over the same K facts (each fact recurs PASSES times, expiring between)
function recurringStream() { const s = []; for (let p = 0; p < PASSES; p++) for (let i = 0; i < K; i++) s.push(FACT(i)); return s; }
// UNIQUE control: K*PASSES all-distinct facts (nothing recurs)
function uniqueStream() { const s = []; for (let i = 0; i < K * PASSES; i++) s.push(`unique fact ${i}: ` + FACT(i * 101)); return s; }

// OFF: recompute every fold. Returns {calls, ms}.
async function armOff(stream) {
  let calls = 0, ms = 0;
  for (const text of stream) { const e = await embedReal(text); calls++; ms += e.ms; }
  return { calls, ms };
}
// ON: allocate from the pool first (reuse), else embed; then release on this fold's expiry so a recurrence reuses it.
async function armOn(stream) {
  const pool = createPool();
  let calls = 0, ms = 0;
  for (const text of stream) {
    let v = pool.allocate(text);                       // recycle released capacity if content recurred
    if (v === null) { const e = await embedReal(text); calls++; ms += e.ms; v = e.vector; } // miss → recompute
    onExpire(pool, 'expire', text, v);                 // this fold later expires → release its capacity to the pool
  }
  return { calls, ms, stats: pool.stats() };
}

console.log(`embed model=${MODEL}  working set K=${K}  passes=${PASSES}  (recurring folds=${K * PASSES})`);
await embedReal('warm the embedding model'); // load once, excluded

const rec = recurringStream(), uni = uniqueStream();
const off = await armOff(rec);   console.log(`OFF (recompute always): ${off.calls} embed calls, ${off.ms}ms`);
const on = await armOn(rec);     console.log(`ON  (recycle on recurrence): ${on.calls} embed calls, ${on.ms}ms  (pool hits=${on.stats.hits})`);
const ctlOff = await armOff(uni); const ctlOn = await armOn(uni);
console.log(`CONTROL all-unique: OFF ${ctlOff.calls} calls / ON ${ctlOn.calls} calls (should match — nothing recurs)`);

const verdict = poolVerdict({
  callsOff: off.calls, callsOn: on.calls, timeOffMs: off.ms, timeOnMs: on.ms,
  controlCallsOff: ctlOff.calls, controlCallsOn: ctlOn.calls,
});
const results = {
  what: 'fold-cycle mechanism 2 — capacity-pooling: release an expired fold\'s embedding to a pool, reuse it when content recurs, instead of recomputing. Measures embedding calls avoided + time saved on a recurring workload.',
  metric: 'real embedding-model calls (nomic-embed-text) avoided, and their wall time — the recycled computation is a genuine model forward pass.',
  embedModel: MODEL, workingSet: K, passes: PASSES,
  recurring: { off, on }, control: { off: ctlOff, on: ctlOn },
  verdict,
  honest: 'The novelty is releasing an EXPIRED fold\'s capacity back into the cycle (strand \'expire\' → pool → reuse), keyed to si-didy/strand.mjs\'s exact decision. Content-keyed caching in general is not novel; the honest test is whether recycling nets when the recomputed embedding is a real, expensive model call — and the control (all-unique) proves it needs recurrence.',
};
writeFileSync(new URL('./results-mech2.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(`\n${verdict.verdict}: ${verdict.why}`);
console.log(`control holds: ${verdict.controlHolds}`);
console.log('wrote results-mech2.json');
