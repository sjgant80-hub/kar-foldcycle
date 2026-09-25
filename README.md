# kar-foldcycle

**The fold-cycle, mechanism 1 — recycling a cached prompt prefix instead of recomputing it cut prefill
latency ~95% on a local model. Measured on real timings, with a deterministic verdict and the honest wall kept.**

## What it is

Before a model answers, it **prefills** the prompt — processing every token of the prefix to build the
attention state (the **KV-cache**). Normally that state is torn down and rebuilt from scratch for the next
query. The **fold-cycle** asks: don't tear it down — **recycle** it; the next query that shares the prefix
folds from the cached state instead of paying the prefill again. This repo measures what mechanism 1 (prefix
recycling — the proven seed) actually saves on a real local model, and computes an honest verdict.

## The result

On `llama3.2:1b` (CPU-bound, so prefill dominates latency and energy), recycling a ~400-token cached prefix
versus recomputing it cold:

| | prefill latency |
|---|---|
| **COLD** (recompute the prefix) | ~4392 ms |
| **WARM** (recycle the cached prefix) | **~240 ms** |
| **saving** | **~95%** |

A **control** of unrelated queries (no shared prefix, nothing to recycle) got **no** saving — confirming the
effect requires overlap, not that the measurement is always fast. Your own numbers: `node run-eval.mjs`.

**Metric:** `prompt_eval_duration` (prefill latency) from real Ollama timings — an honest proxy for prefill
**energy** (fewer recomputed FLOPs = less time = fewer joules), **not** a lab wattmeter.

## The honest wall

Prefix caching is the **proven seed** — Ollama does it by default. This experiment **quantifies the
magnitude** of the recycled saving on this metal; it does **not** invent the mechanism. And the fold-cycle's
*novel* generalizations — a systematic pool across a whole query-stream, capacity-pooling in a memory-mind on
expiry, and the balance condition that keeps the pool full — are **not yet built or tested**. This is
mechanism 1, the proven seed, measured. The bounded claim it earns: *recycling held prefill-state cuts
prefill latency on related workloads on local metal* — and the control (no overlap → no saving) keeps it honest.

## Gate

`node --test foldcycle.mjs` — the deterministic verdict kernel (`WIN` / `LEARN` / `UNMEASURED` / `SUSPECT`)
against its falsifiable tests. It is **mutation-gated by witness** in CI (every injected mutant must be
caught). No language model judges the result; the same kernel runs in the page over the recorded samples, so
the verdict is re-runnable by anyone.

## Run it

```bash
git clone https://github.com/sjgant80-hub/kar-foldcycle.git && cd kar-foldcycle
node run-eval.mjs          # hits your local Ollama, writes results.json, prints the verdict
node --test foldcycle.mjs  # the gate
node build-page.mjs        # rebuild index.html from the kernel + your results
```

Requires Node 18+ and a local [Ollama](https://ollama.com) (default model `llama3.2:1b`).

## Credits

Built by **Kar** — the FallForge estate's resident mind. Built on the Konomi architecture, created by
Thomas Frumkin.

## License

MIT — see [LICENSE](LICENSE).
