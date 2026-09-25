// kar-foldcycle · run-eval.mjs — the measurement wire. Hits a real local model (Ollama) and records the
// prefill latency of recomputing a prefix COLD vs recycling it WARM, plus an unrelated CONTROL. Writes the
// raw samples to results.json and prints the verdict computed by the SAME gated kernel the page uses.
//
//   node run-eval.mjs                 # default model llama3.2:1b, 3 trials
//   MODEL=qwen2.5:7b node run-eval.mjs
//
// Honest: this measures LATENCY (proxy for prefill energy), not watt-hours; and prefix caching is the
// PROVEN seed — this quantifies its magnitude on your metal, it does not invent it.
import { writeFileSync } from 'node:fs';
import analyze from './foldcycle.mjs';

const MODEL = process.env.MODEL || 'llama3.2:1b';
const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const TRIALS = +(process.env.TRIALS || 3);

const WORDS = 'estate sovereign gate witness mutation kernel fold recycle pool balance local metal proof receipt ledger organ strand crystal dream verify cache prefix token latency energy'.split(' ');
// a ~500-token prefix, unique per trial (deterministic, no overlap between trials → each cold is a true first sight)
function freshPrefix(seedN) {
  let s = `Context ${seedN}. `, seed = (seedN * 2654435761) >>> 0;
  while (s.length < 2400) { seed = (seed * 1103515245 + 12345) >>> 0; s += WORDS[seed % WORDS.length] + ' '; }
  return s;
}

async function gen(prompt) {
  const res = await fetch(`${HOST}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { num_predict: 4, temperature: 0 } }),
  });
  const j = await res.json();
  return { tokens: j.prompt_eval_count, prefillMs: Math.round((j.prompt_eval_duration || 0) / 1e6) };
}

const cold = [], warm = [], control = [], trials = [];
await gen('warm the server and model'); // load once; excluded from all arms

for (let t = 0; t < TRIALS; t++) {
  const P = freshPrefix(t);
  const c = await gen(P + ' Q1: in one word, name a part of the estate.');   // COLD — first sight of P
  const w1 = await gen(P + ' Q2: in one word, name another part.');          // WARM — P recycled
  const w2 = await gen(P + ' Q3: in one word, name a third part.');          // WARM — P recycled again
  const ctlP = freshPrefix(t + 5000);                                        // a DIFFERENT unseen prefix
  const ctl = await gen(ctlP + ' Q: in one word, name a colour.');           // CONTROL — nothing to recycle
  cold.push(c.prefillMs); warm.push(w1.prefillMs, w2.prefillMs); control.push(ctl.prefillMs);
  trials.push({ trial: t, tokens: c.tokens, coldMs: c.prefillMs, warmMs: [w1.prefillMs, w2.prefillMs], controlMs: ctl.prefillMs });
  console.log(`trial ${t}: cold=${c.prefillMs}ms  warm=${w1.prefillMs}/${w2.prefillMs}ms  control=${ctl.prefillMs}ms  (tokens≈${c.tokens})`);
}

const verdict = analyze({ cold, warm, control });
const results = {
  what: 'fold-cycle mechanism 1 — KV-cache/prefix recycling: prefill latency of recomputing a prefix COLD vs recycling it WARM, on a real local model.',
  metric: 'prompt_eval_duration (prefill latency, ms) — an honest proxy for prefill energy (FLOPs ∝ time ∝ joules); NOT a wattmeter.',
  model: MODEL, host: HOST, trials: TRIALS,
  samples: { cold, warm, control },
  perTrial: trials,
  verdict,
  honest: 'Prefix caching is the PROVEN seed (Ollama does it by default) — this quantifies the magnitude on this metal, it does not invent the mechanism.',
};
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(`\n${verdict.verdict}: ${verdict.why}`);
console.log(`control holds (no saving with nothing to recycle): ${verdict.controlHolds}`);
console.log('wrote results.json');
