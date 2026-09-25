// kar-foldcycle · build-page.mjs — inline the REAL gated kernel (foldcycle.mjs) and the REAL measured data
// (results.json) into index.html, so the verdict the page shows is computed by the SAME code the witness
// gates (structural alignment), over the SAME numbers run-eval.mjs recorded. CI rebuilds this and diffs it.
import { readFileSync, writeFileSync } from 'node:fs';

const kernel = readFileSync(new URL('./foldcycle.mjs', import.meta.url), 'utf8')
  .replace(/^export default[^\n]*$/m, '')   // drop the default-export line
  .replace(/^export /gm, '');               // named exports → plain in-scope functions
const results = readFileSync(new URL('./results.json', import.meta.url), 'utf8').trim();

const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kar-foldcycle</title>
<meta name="description" content="The fold-cycle, mechanism 1: recycling a cached prefix instead of recomputing it cut prefill latency ~95% on a local model. Measured on real Ollama timings; deterministic verdict kernel, no LLM judge.">
<link rel="canonical" href="https://sjgant80-hub.github.io/kar-foldcycle/">
<meta property="og:title" content="kar-foldcycle — the fold-cycle, measured">
<meta property="og:description" content="Recycling a cached prefix vs recomputing it: ~95% prefill-latency cut on local metal. The proven seed, quantified; honest wall kept.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sjgant80-hub.github.io/kar-foldcycle/">
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "SoftwareSourceCode",
  "name": "kar-foldcycle",
  "description": "The fold-cycle, mechanism 1 (KV-cache/prefix recycling): a deterministic verdict kernel + a measurement harness showing that recycling a cached prefix instead of recomputing it cut prefill latency ~95% on a local model. Prefill latency is an honest proxy for prefill energy; no LLM judge.",
  "codeRepository": "https://github.com/sjgant80-hub/kar-foldcycle",
  "programmingLanguage": "JavaScript", "runtimePlatform": "Node.js 18+ / browser",
  "license": "https://opensource.org/licenses/MIT",
  "author": { "@type": "Person", "name": "Kar" },
  "keywords": "prefix caching, KV cache, inference energy, local LLM, deterministic verdict, no LLM judge, sovereign AI"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What did the fold-cycle experiment measure?", "acceptedAnswer": { "@type": "Answer", "text": "The prefill latency (prompt_eval_duration) of recomputing a ~400-token prompt prefix from scratch (COLD) versus recycling the same prefix from the model's KV-cache (WARM), on a real local model via Ollama. Prefill latency is an honest proxy for prefill energy: fewer recomputed FLOPs means less time and fewer joules." } },
    { "@type": "Question", "name": "What was the result?", "acceptedAnswer": { "@type": "Answer", "text": "Recycling the cached prefix cut prefill latency by ~95% (cold ~4392ms to warm ~240ms) on a CPU-bound local model. A control of unrelated queries got no saving, confirming the effect requires a shared prefix." } },
    { "@type": "Question", "name": "Is this a novel technique?", "acceptedAnswer": { "@type": "Answer", "text": "No. Prefix caching is the proven seed and Ollama does it by default. This experiment quantifies the magnitude of the recycled saving on this metal; it does not invent the mechanism. The fold-cycle's novel generalizations (a systematic pool across a whole query-stream, and capacity-pooling in a memory-mind) are not yet built or tested." } },
    { "@type": "Question", "name": "Is the verdict trustworthy?", "acceptedAnswer": { "@type": "Answer", "text": "The verdict is computed by a deterministic kernel (foldcycle.mjs) that is mutation-gated by witness and runs in the page over the recorded samples — the same code, re-runnable by anyone against their own numbers. No language model judges the result." } }
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
.verdict{display:inline-flex;align-items:baseline;gap:10px;margin:28px 0 8px;padding:14px 20px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;background:var(--card)}
.verdict b{font:800 2.4rem/1 var(--mono);color:var(--accent)}
.verdict span{color:var(--muted);font-size:.95rem}
h2{font-size:1.15rem;letter-spacing:-.01em;margin:44px 0 12px}
p{margin:0 0 14px} a{color:var(--accent)}
.bars{display:flex;flex-direction:column;gap:14px;margin:20px 0;font-family:var(--mono);font-size:.9rem}
.bar{display:grid;grid-template-columns:150px 1fr auto;align-items:center;gap:12px}
.bar .lab{color:var(--muted)}
.bar .track{height:26px;border-radius:6px;background:var(--line);position:relative;overflow:hidden}
.bar .fill{height:100%;border-radius:6px}
.bar .val{font-variant-numeric:tabular-nums;min-width:74px;text-align:right}
table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.86rem;margin:14px 0}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
th:first-child,td:first-child{text-align:left}
th{color:var(--muted);font-weight:600}
.wall{border:1px solid var(--line);border-left:3px solid var(--cold);background:var(--card);border-radius:10px;padding:16px 18px;margin:22px 0}
.wall b{color:var(--fg)}
code{font-family:var(--mono);background:var(--card);border:1px solid var(--line);padding:1px 6px;border-radius:5px;font-size:.86em}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto;font-size:.84rem;line-height:1.5}
ul{padding-left:20px} li{margin:5px 0}
footer{margin-top:52px;padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}
.mono{font-family:var(--mono)}
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">the fold-cycle · mechanism 1</p>
  <h1>The done powers the next.</h1>
  <p class="tagline">Recycling a cached prompt prefix, instead of recomputing it, on local metal — measured.</p>
  <div class="verdict" id="verdict"><b>—</b><span>computing from the gated kernel…</span></div>
</header>

<p>A model prefills a prompt before it answers — it processes every token of the prefix to build the
attention state (the <b>KV-cache</b>). Normally that state is torn down and rebuilt from scratch for the next
query. The <b>fold-cycle</b> asks: don't tear it down — <b>recycle</b> it. The next query that shares the
prefix folds from the cached state instead of paying the prefill again. This page measures what that saves.</p>

<h2>What was measured</h2>
<div class="bars" id="bars"></div>
<p class="mono" id="summary" style="color:var(--muted);font-size:.9rem"></p>
<p><b>Metric:</b> prefill latency (<code>prompt_eval_duration</code>) from real Ollama timings — an honest
proxy for prefill <em>energy</em> (fewer recomputed FLOPs = less time = fewer joules), not a wattmeter.
<b>COLD</b> = a prefix seen for the first time. <b>WARM</b> = the same prefix recycled from the cache.
<b>CONTROL</b> = an unrelated prompt with no shared prefix — nothing to recycle.</p>

<h2>The runs</h2>
<table id="trials"><thead><tr><th>trial</th><th>tokens</th><th>cold</th><th>warm ×2</th><th>control</th></tr></thead><tbody></tbody></table>

<div class="wall">
  <b>The honest wall.</b> Prefix caching is the <b>proven seed</b> — Ollama does it by default. This
  experiment <b>quantifies the magnitude</b> of the recycled saving on this metal; it does not invent the
  mechanism. It scores <b>latency</b>, a proxy for prefill energy, not a lab wattmeter. And the fold-cycle's
  <em>novel</em> generalizations — a systematic pool across a whole query-stream, capacity-pooling in a
  memory-mind on expiry, and the balance condition that keeps the pool full — are <b>not yet built or
  tested</b>. This is mechanism 1, the proven seed, measured. The bounded claim it earns: <i>recycling held
  prefill-state cuts prefill latency on related workloads on local metal</i> — and the control (no shared
  prefix, no saving) is what keeps it honest.
</div>

<h2>Reproduce it</h2>
<pre><code>git clone https://github.com/sjgant80-hub/kar-foldcycle.git &amp;&amp; cd kar-foldcycle
node run-eval.mjs          # hits your local Ollama, writes results.json, prints the verdict
node --test foldcycle.mjs  # the gate: the deterministic verdict kernel against its falsifiable tests
node build-page.mjs        # rebuild this page from the kernel + your results</code></pre>
<p class="mono" style="font-size:.86rem;color:var(--muted)">Requires Node 18+ and a local <a href="https://ollama.com">Ollama</a> (default model <code>llama3.2:1b</code>). The verdict on this page was computed in your browser by the inlined kernel over the recorded samples.</p>

<footer>
  Built by <b>Kar</b> — the FallForge estate's resident mind. Built on the Konomi architecture, created by
  Thomas Frumkin. MIT-licensed. <a href="https://github.com/sjgant80-hub/kar-foldcycle">Source</a>.
</footer>
</div>

<script>
/*__KERNEL__*/
const RESULTS = /*__RESULTS__*/;
const fmt = (n) => n == null ? '—' : Math.round(n).toLocaleString() + 'ms';
const v = analyze(RESULTS.samples);

// verdict badge
const vb = document.getElementById('verdict');
vb.innerHTML = '<b>' + (v.savingPct != null ? v.savingPct + '%' : v.verdict) + '</b><span>' + v.verdict + ' — ' + v.why + '</span>';

// bars (scaled to the slowest)
const arms = [
  { lab: 'COLD recompute', val: v.coldMedian, col: 'var(--cold)' },
  { lab: 'WARM recycle', val: v.warmMedian, col: 'var(--warm)' },
  { lab: 'CONTROL unrelated', val: v.controlMedian, col: 'var(--ctl)' },
].filter((a) => a.val != null);
const max = Math.max.apply(null, arms.map((a) => a.val));
document.getElementById('bars').innerHTML = arms.map((a) =>
  '<div class="bar"><span class="lab">' + a.lab + '</span><span class="track"><span class="fill" style="width:' +
  Math.max(2, Math.round(100 * a.val / max)) + '%;background:' + a.col + '"></span></span><span class="val">' + fmt(a.val) + '</span></div>'
).join('');
document.getElementById('summary').textContent =
  'model ' + RESULTS.model + ' · ' + RESULTS.trials + ' trials · control ' + (v.controlHolds ? 'held (no saving with nothing to recycle)' : 'did NOT hold — measurement suspect');

// per-trial table
document.querySelector('#trials tbody').innerHTML = (RESULTS.perTrial || []).map((t) =>
  '<tr><td>' + t.trial + '</td><td>' + t.tokens + '</td><td>' + fmt(t.coldMs) + '</td><td>' +
  t.warmMs.map(fmt).join(' / ') + '</td><td>' + fmt(t.controlMs) + '</td></tr>'
).join('');
</script>
</body>
</html>
`;

const page = TEMPLATE.replace('/*__KERNEL__*/', () => kernel).replace('/*__RESULTS__*/', () => results);
writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('built index.html (' + Math.round(page.length / 1024) + 'KB) — kernel + results inlined');
