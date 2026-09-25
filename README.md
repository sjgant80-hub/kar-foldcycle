# kar-foldcycle

**▶ Live:** https://sjgant80-hub.github.io/kar-foldcycle/

**The fold-cycle — recycling held compute-state instead of recomputing it. Mechanism 1 (prefix recycling)
cut prefill latency ~95%; mechanism 2 (capacity-pooling on fold-expiry) avoided ~67% of expensive embedding
calls. Measured on real local models, with deterministic verdicts and the honest wall kept.**

## What it is

A computation folds structures that cost energy to build — a **KV-cache**, a computed **embedding**.
Normally they're torn down and rebuilt for the next computation. The **fold-cycle** asks: don't tear them
down — **recycle** them; release a completed fold's held capacity and fold the next computation from it. This
repo measures two mechanisms on real local models and computes an honest verdict for each (no LLM judge).

## Mechanism 1 — prefix recycling (the proven seed)

Before a model answers it **prefills** the prompt — processing every prefix token to build the KV-cache.
Recycling that cache for a query that shares the prefix, instead of recomputing it cold, on `llama3.2:1b`
(CPU-bound, so prefill dominates):

| | prefill latency |
|---|---|
| **COLD** (recompute) | ~4392 ms |
| **WARM** (recycle) | **~240 ms** |
| **saving** | **~95%** |

A control of unrelated queries got **no** saving. Metric: real Ollama `prompt_eval_duration`, an honest
proxy for prefill energy. `node run-eval.mjs`.

## Mechanism 2 — capacity-pooling (the novel step)

A memory fold holds a computed **embedding** — an expensive model call. When the fold **expires** (the
strand decides `expire` — see `si-didy/strand.mjs`), instead of discarding that embedding we **release** it
to a content-keyed pool; a later fold whose content **recurs** reuses it instead of recomputing. Measured
with real `nomic-embed-text` calls on a recurring workload:

| | embedding calls |
|---|---|
| **OFF** (recompute always) | 45 |
| **ON** (recycle on recurrence) | **15** |
| **saving** | **~67%** calls (and ~67% embed time) |

A control of **all-unique** content got no saving — the effect requires recurrence, and mechanism 2 wins
because the recycled computation is a *real, expensive* embedding. `node run-mech2.mjs`.

## The honest wall

**Mechanism 1** is the **proven seed** — prefix caching, which Ollama does by default — so this **quantifies
its magnitude**, it does not invent it. **Mechanism 2's** novelty is releasing an *expired* fold's capacity
back into the cycle (keyed to the strand's exact `expire` decision); content-keyed caching in general is not
novel, and the honest test is whether recycling nets when the recomputed value is a *real, expensive*
embedding — the control (all-unique → no saving) is what proves the effect needs recurrence, not the
measurement being always fast. Both are latency / call-count proxies for energy, **not** a lab wattmeter.
And **mechanism 3** — the *balance condition* that keeps the pool full across a live query-stream — is
**not yet built or tested**.

## Gate

`node --test` — both deterministic verdict kernels (`foldcycle.mjs`, `capacitypool.mjs`; each returns
`WIN` / `LEARN` / `UNMEASURED` / `SUSPECT`) against their falsifiable tests. Both are **mutation-gated by
witness** in CI (every injected mutant caught; both CLEAN 1.0). No language model judges the result; the
same kernels run in the page over the recorded samples, so every verdict is re-runnable by anyone.

## Run it

```bash
git clone https://github.com/sjgant80-hub/kar-foldcycle.git && cd kar-foldcycle
node run-eval.mjs          # mechanism 1: prefix recycling (writes results.json)
node run-mech2.mjs         # mechanism 2: capacity-pooling (needs nomic-embed-text; writes results-mech2.json)
node --test               # the gates
node build-page.mjs        # rebuild index.html from the kernels + your results
```

Requires Node 18+ and a local [Ollama](https://ollama.com). Mechanism 2 uses the `nomic-embed-text` model
(`ollama pull nomic-embed-text`).

## Credits

Built by **Kar** — the FallForge estate's resident mind. Built on the Konomi architecture, created by
Thomas Frumkin.

## License

MIT — see [LICENSE](LICENSE).
