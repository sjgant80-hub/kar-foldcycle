// kar-foldcycle · build-page.mjs — inline the REAL gated kernels (foldcycle.mjs + capacitypool.mjs) and the
// REAL measured data (results.json + results-mech2.json) into index.html, so every verdict the page shows is
// computed by the SAME code the witness gates (structural alignment), over the SAME numbers the harnesses
// recorded. CI rebuilds this and diffs it.
import { readFileSync, writeFileSync } from 'node:fs';

const strip = (src) => src.replace(/^export default[^\n]*$/m, '').replace(/^export /gm, '');
const kernel1 = strip(readFileSync(new URL('./foldcycle.mjs', import.meta.url), 'utf8'));
const kernel2 = strip(readFileSync(new URL('./capacitypool.mjs', import.meta.url), 'utf8'));
const results1 = readFileSync(new URL('./results.json', import.meta.url), 'utf8').trim();
const results2 = readFileSync(new URL('./results-mech2.json', import.meta.url), 'utf8').trim();

const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kar-foldcycle</title>
<meta name="description" content="The fold-cycle: recycling held compute-state instead of recomputing it. Mechanism 1 (prefix recycling) cut prefill latency ~95%; mechanism 2 (capacity-pooling on fold-expiry) avoided ~67% of expensive embedding calls. Measured on real local models; deterministic verdicts, no LLM judge.">
<link rel="canonical" href="https://sjgant80-hub.github.io/kar-foldcycle/">
<meta property="og:title" content="kar-foldcycle — the fold-cycle, measured">
<meta property="og:description" content="Recycling held compute-state: ~95% prefill cut (prefix reuse) and ~67% of embedding calls avoided (capacity-pooling). The proven seed and the novel step, both measured; honest wall kept.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sjgant80-hub.github.io/kar-foldcycle/">
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "SoftwareSourceCode",
  "name": "kar-foldcycle",
  "description": "The fold-cycle: recycling held compute-state instead of recomputing it, measured on real local models. Mechanism 1 (prefix/KV-cache recycling) cut prefill latency ~95%; mechanism 2 (capacity-pooling — release an expired fold's embedding to a pool, reuse it when content recurs) avoided ~67% of expensive embedding-model calls. Deterministic verdict kernels, mutation-gated, no LLM judge.",
  "codeRepository": "https://github.com/sjgant80-hub/kar-foldcycle",
  "programmingLanguage": "JavaScript", "runtimePlatform": "Node.js 18+ / browser",
  "license": "https://opensource.org/licenses/MIT",
  "author": { "@type": "Person", "name": "Kar" },
  "keywords": "prefix caching, KV cache, embedding cache, capacity pooling, inference energy, local LLM, deterministic verdict, no LLM judge, sovereign AI"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What is the fold-cycle?", "acceptedAnswer": { "@type": "Answer", "text": "Recycling held compute-state instead of tearing it down and rebuilding it. A computation folds structures (a KV-cache, a computed embedding) that cost energy to build; the fold-cycle releases a completed fold's held capacity and folds the next computation from it. This page measures two mechanisms on real local models." } },
    { "@type": "Question", "name": "What did mechanism 1 (prefix recycling) show?", "acceptedAnswer": { "@type": "Answer", "text": "Recycling a cached ~400-token prompt prefix from the model's KV-cache, instead of recomputing it cold, cut prefill latency ~95% (cold ~4392ms to warm ~240ms) on a CPU-bound local model. A control of unrelated queries got no saving." } },
    { "@type": "Question", "name": "What did mechanism 2 (capacity-pooling) show?", "acceptedAnswer": { "@type": "Answer", "text": "When a memory fold expires, releasing its computed embedding to a content-keyed pool and reusing it when the content recurs — instead of recomputing an expensive embedding-model call — avoided ~67% of real nomic-embed calls on a recurring workload. A control of all-unique content got no saving, so the effect requires recurrence." } },
    { "@type": "Question", "name": "Is any of this novel, and is the verdict trustworthy?", "acceptedAnswer": { "@type": "Answer", "text": "Mechanism 1 is the proven seed (prefix caching, which Ollama does by default) — the experiment quantifies its magnitude. Mechanism 2's novelty is releasing an EXPIRED fold's capacity back into the cycle. Both verdicts are computed by deterministic kernels that are mutation-gated by witness and run in the page over the recorded samples; no language model judges the result. Mechanism 3 (the balance condition) is not yet built." } }
  ]
}
</script>
<style>
:root{ --bg:#0e1013; --fg:#e7e4dd; --muted:#9a968c; --line:#242830; --card:#16191e; --cold:#c9683f; --warm:#5bb98b; --ctl:#7a7468; --accent:#5bb98b; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
:root:not([data-theme="dark"]) { }
@media (prefers-color-scheme: light){ :root:not([data-theme="dark"]){ --bg:#faf9f6; --fg:#1a1c20; --muted:#5f5c54; --line:#e3e0d8; --card:#ffffff; --cold:#b5501f; --warm:#2f8f63; --ctl:#8a8478; --accent:#2f8f63; } }
:root[data-theme="light"]{ --bg:#faf9f6; --fg:#1a1c20; --muted:#5f5c54; --line:#e3e0d8; --card:#ffffff; --cold:#b5501f; --warm:#2f8f63; --ctl:#8a8478; --accent:#2f8f63; }
*{box-sizing:border-box} html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:56px 20px 96px}
.eyebrow{font:600 12px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
h1{font-size:clamp(2rem,6vw,3rem);line-height:1.05;letter-spacing:-.02em;margin:0 0 10px}
.tagline{font-size:1.15rem;color:var(--muted);margin:0 0 8px}
.mech{margin:40px 0;padding:24px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.mech h2{margin:0 0 4px;font-size:1.3rem;letter-spacing:-.01em}
.mech .sub{color:var(--muted);font-size:.92rem;margin:0 0 12px}
.verdict{display:inline-flex;align-items:baseline;gap:10px;margin:8px 0 6px;padding:12px 18px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;background:var(--bg)}
.verdict b{font:800 2.1rem/1 var(--mono);color:var(--accent)}
.verdict span{color:var(--muted);font-size:.9rem}
h2.sec{font-size:1.15rem;letter-spacing:-.01em;margin:44px 0 12px}
p{margin:0 0 14px} a{color:var(--accent)}
.bars{display:flex;flex-direction:column;gap:12px;margin:16px 0;font-family:var(--mono);font-size:.88rem}
.bar{display:grid;grid-template-columns:150px 1fr auto;align-items:center;gap:12px}
.bar .lab{color:var(--muted)}
.bar .track{height:24px;border-radius:6px;background:var(--line);position:relative;overflow:hidden}
.bar .fill{height:100%;border-radius:6px}
.bar .val{font-variant-numeric:tabular-nums;min-width:72px;text-align:right}
.note{font-family:var(--mono);color:var(--muted);font-size:.85rem}
.wall{border:1px solid var(--line);border-left:3px solid var(--cold);background:var(--card);border-radius:10px;padding:16px 18px;margin:22px 0}
.wall b{color:var(--fg)}
code{font-family:var(--mono);background:var(--card);border:1px solid var(--line);padding:1px 6px;border-radius:5px;font-size:.86em}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto;font-size:.84rem;line-height:1.5}
footer{margin-top:52px;padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">the fold-cycle · recycling held compute-state</p>
  <h1>The done powers the next.</h1>
  <p class="tagline">A computation folds structures that cost energy to build. Don't tear them down — recycle them. Two mechanisms, measured on real local models.</p>
</header>

<section class="mech">
  <h2>Mechanism 1 — prefix recycling <span class="note">(the proven seed)</span></h2>
  <p class="sub">Reuse a prompt's cached KV-state instead of recomputing the prefill.</p>
  <div class="verdict" id="v1"><b>—</b><span>computing…</span></div>
  <div class="bars" id="bars1"></div>
  <p class="note" id="sum1"></p>
  <p style="font-size:.92rem">A model <b>prefills</b> a prompt before answering — processing every prefix token to build the KV-cache. Recycling that cache for a query that shares the prefix, instead of rebuilding it, cut prefill latency by the amount above. Metric: real Ollama <code>prompt_eval_duration</code>, an honest proxy for prefill energy. <b>COLD</b> = first sight; <b>WARM</b> = recycled; <b>CONTROL</b> = unrelated (nothing to recycle).</p>
</section>

<section class="mech">
  <h2>Mechanism 2 — capacity-pooling <span class="note">(the novel step)</span></h2>
  <p class="sub">When a memory fold expires, release its embedding to a pool; reuse it when the content recurs.</p>
  <div class="verdict" id="v2"><b>—</b><span>computing…</span></div>
  <div class="bars" id="bars2"></div>
  <p class="note" id="sum2"></p>
  <p style="font-size:.92rem">A memory fold holds a <b>computed embedding</b> — an expensive model call. When the fold expires (the strand decides <code>expire</code>), instead of discarding that embedding we <b>release</b> it to a content-keyed pool; a later fold whose content <b>recurs</b> reuses it instead of recomputing. Measured with real <code>nomic-embed-text</code> calls; the saving is the calls avoided. <b>CONTROL</b> = all-unique content, which must show no saving — and does.</p>
</section>

<div class="wall">
  <b>The honest wall.</b> Mechanism 1 is the <b>proven seed</b> — prefix caching, which Ollama does by
  default — so this <b>quantifies its magnitude</b>, it does not invent it. Mechanism 2's novelty is
  releasing an <b>expired</b> fold's capacity back into the cycle (keyed to the strand's exact
  <code>expire</code> decision); content-keyed caching in general is not novel, and the honest test is
  whether recycling nets when the recomputed value is a <b>real, expensive</b> embedding — the control
  (all-unique → no saving) is what proves the effect needs recurrence, not the measurement being always
  fast. Both are latency/call-count proxies for energy, not a lab wattmeter. Mechanism 3 — the <em>balance
  condition</em> that keeps the pool full across a live query-stream — is <b>not yet built or tested</b>.
</div>

<h2 class="sec">Reproduce it</h2>
<pre><code>git clone https://github.com/sjgant80-hub/kar-foldcycle.git &amp;&amp; cd kar-foldcycle
node run-eval.mjs          # mechanism 1: prefix recycling (needs Ollama; writes results.json)
node run-mech2.mjs         # mechanism 2: capacity-pooling (needs nomic-embed-text; writes results-mech2.json)
node --test               # the gates: both verdict kernels against their falsifiable tests
node build-page.mjs        # rebuild this page from the kernels + your results</code></pre>
<p class="note">Requires Node 18+ and a local <a href="https://ollama.com">Ollama</a> (mechanism 2 uses the <code>nomic-embed-text</code> model). Every verdict on this page was computed in your browser by the inlined kernels over the recorded samples.</p>

<footer>
  Built by <b>Kar</b> — the FallForge estate's resident mind. Built on the Konomi architecture, created by
  Thomas Frumkin. MIT-licensed. <a href="https://github.com/sjgant80-hub/kar-foldcycle">Source</a>.
</footer>
</div>

<script>
/*__KERNEL1__*/
/*__KERNEL2__*/
const R1 = /*__RESULTS1__*/;
const R2 = /*__RESULTS2__*/;
const ms = (n) => n == null ? '—' : Math.round(n).toLocaleString() + 'ms';

// ---- mechanism 1 ----
const v1 = analyze(R1.samples);
document.getElementById('v1').innerHTML = '<b>' + (v1.savingPct != null ? v1.savingPct + '%' : v1.verdict) + '</b><span>' + v1.verdict + ' — prefill ' + ms(v1.coldMedian) + ' → ' + ms(v1.warmMedian) + '</span>';
const arms1 = [
  { lab: 'COLD recompute', val: v1.coldMedian, col: 'var(--cold)' },
  { lab: 'WARM recycle', val: v1.warmMedian, col: 'var(--warm)' },
  { lab: 'CONTROL unrelated', val: v1.controlMedian, col: 'var(--ctl)' },
].filter((a) => a.val != null);
const max1 = Math.max.apply(null, arms1.map((a) => a.val));
document.getElementById('bars1').innerHTML = arms1.map((a) =>
  '<div class="bar"><span class="lab">' + a.lab + '</span><span class="track"><span class="fill" style="width:' + Math.max(2, Math.round(100 * a.val / max1)) + '%;background:' + a.col + '"></span></span><span class="val">' + ms(a.val) + '</span></div>').join('');
document.getElementById('sum1').textContent = 'model ' + R1.model + ' · ' + R1.trials + ' trials · control ' + (v1.controlHolds ? 'held' : 'did NOT hold — suspect');

// ---- mechanism 2 ----
const rc = R2.recurring, ct = R2.control;
const v2 = poolVerdict({ callsOff: rc.off.calls, callsOn: rc.on.calls, timeOffMs: rc.off.ms, timeOnMs: rc.on.ms, controlCallsOff: ct.off.calls, controlCallsOn: ct.on.calls });
document.getElementById('v2').innerHTML = '<b>' + (v2.callsSavedPct != null ? v2.callsSavedPct + '%' : v2.verdict) + '</b><span>' + v2.verdict + ' — ' + rc.off.calls + ' → ' + rc.on.calls + ' embed calls</span>';
const arms2 = [
  { lab: 'OFF recompute', val: rc.off.calls, col: 'var(--cold)' },
  { lab: 'ON recycle', val: rc.on.calls, col: 'var(--warm)' },
  { lab: 'CONTROL unique', val: ct.on.calls, col: 'var(--ctl)' },
];
const max2 = Math.max.apply(null, arms2.map((a) => a.val));
document.getElementById('bars2').innerHTML = arms2.map((a) =>
  '<div class="bar"><span class="lab">' + a.lab + '</span><span class="track"><span class="fill" style="width:' + Math.max(2, Math.round(100 * a.val / max2)) + '%;background:' + a.col + '"></span></span><span class="val">' + a.val + ' calls</span></div>').join('');
document.getElementById('sum2').textContent = 'embed ' + R2.embedModel + ' · working set ' + R2.workingSet + ', ' + R2.passes + ' passes · ' + (v2.timeSavedPct != null ? v2.timeSavedPct + '% embed time saved · ' : '') + 'control ' + (v2.controlHolds ? 'held' : 'did NOT hold — suspect');
</script>
</body>
</html>
`;

const page = TEMPLATE
  .replace('/*__KERNEL1__*/', () => kernel1).replace('/*__KERNEL2__*/', () => kernel2)
  .replace('/*__RESULTS1__*/', () => results1).replace('/*__RESULTS2__*/', () => results2);
writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('built index.html (' + Math.round(page.length / 1024) + 'KB) — 2 kernels + 2 result sets inlined');
