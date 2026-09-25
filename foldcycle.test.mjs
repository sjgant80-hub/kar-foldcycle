// kar-foldcycle · foldcycle.test.mjs — every rule falsifiable: a real reuse-saving reads WIN, a null saving
// reads LEARN, an empty run reads UNMEASURED (never a silent pass), a control that also sped up reads SUSPECT,
// and no garbage input throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import analyze, { median, mean } from './foldcycle.mjs';

test('MEDIAN / MEAN — correct, and empty is null (not 0, which would read as "measured")', () => {
  assert.equal(median([190, 210, 200]), 200);
  assert.equal(median([187, 211]), 199);
  assert.equal(median([]), null);
  assert.equal(mean([100, 200, 300]), 200);
  assert.equal(mean([]), null);
});

test('WIN — a large reuse saving (cold recompute vs warm recycle) is scored WIN with the right %', () => {
  const r = analyze({ cold: [4615, 4700, 4520], warm: [187, 211, 199] });
  assert.equal(r.verdict, 'WIN');
  assert.ok(r.savingPct >= 90, 'a ~96% saving must read as a large win, got ' + r.savingPct);
  assert.equal(r.coldMedian, 4615);
  assert.equal(r.warmMedian, 199);
});

test('LEARN — a null / tiny saving is NOT dressed up as a win', () => {
  const r = analyze({ cold: [300, 310], warm: [295, 298] });
  assert.equal(r.verdict, 'LEARN');
  assert.ok(r.savingPct < 20, 'a few-% saving must read LEARN, got ' + r.savingPct);
});

test('THRESHOLD boundary — exactly at the threshold is a WIN, just under is a LEARN', () => {
  assert.equal(analyze({ cold: [100], warm: [80], thresholdPct: 20 }).verdict, 'WIN');   // 20% == threshold
  assert.equal(analyze({ cold: [100], warm: [81], thresholdPct: 20 }).verdict, 'LEARN'); // 19% < threshold
});

test('UNMEASURED — an empty or one-sided run is not a clean pass (anti-narrowing)', () => {
  assert.equal(analyze({ cold: [], warm: [200] }).verdict, 'UNMEASURED');
  assert.equal(analyze({ cold: [4600], warm: [] }).verdict, 'UNMEASURED');
  assert.equal(analyze({}).verdict, 'UNMEASURED');
  assert.equal(analyze().verdict, 'UNMEASURED');
});

test('CONTROL HOLDS — an unrelated control that stays slow confirms the saving is real reuse', () => {
  const r = analyze({ cold: [4615, 4700], warm: [187, 211], control: [6178, 6000] });
  assert.equal(r.verdict, 'WIN');
  assert.equal(r.controlHolds, true, 'control (no shared prefix) got no saving — the finding stands');
});

test('SUSPECT — if the control ALSO sped up, the measurement is called out, not trusted', () => {
  // a genuine prefix-reuse saving must be ABSENT with nothing to recycle; if the "control" is fast too,
  // something other than reuse made it fast — the spec's own falsifier.
  const r = analyze({ cold: [4600, 4700], warm: [190, 200], control: [210, 205] });
  assert.equal(r.verdict, 'SUSPECT');
  assert.match(r.why, /suspect/i);
});

test('ZERO-latency samples are kept (a 0ms cached prefill is real) and never divide-by-zero', () => {
  assert.equal(median([0, 200]), 100, 'a 0ms sample is a real measurement, kept — not dropped as garbage');
  const z = analyze({ cold: [0], warm: [0], control: [0] });
  assert.equal(z.savingPct, 0, 'coldMedian 0 must yield 0%, not NaN/Infinity');
  assert.equal(z.controlSavingPct, 0, 'control divide-by-zero guarded too');
});

test('WHY text matches the verdict — the win and learn messages are not swapped', () => {
  assert.match(analyze({ cold: [4600], warm: [200] }).why, /cut prefill latency/);
  assert.match(analyze({ cold: [300], warm: [295] }).why, /no meaningful/);
});

test('CONTROL exactly at the threshold does NOT hold → SUSPECT (strict <, not <=)', () => {
  // control sped up exactly thresholdPct% vs cold = a meaningful control speed-up = the finding is suspect
  const r = analyze({ cold: [100, 100], warm: [10], control: [80, 80], thresholdPct: 20 });
  assert.equal(r.controlSavingPct, 20);
  assert.equal(r.controlHolds, false, 'a control at the threshold does not count as "held"');
  assert.equal(r.verdict, 'SUSPECT');
});

test('FUZZ — never throws on garbage; bad samples are filtered, not counted', () => {
  for (const g of [null, undefined, 7, {}, [], 'x', { cold: 'a', warm: 5 }, { cold: [NaN, -3, 'z', 200], warm: [Infinity, 100] }]) {
    const r = analyze(g);
    assert.equal(typeof r.verdict, 'string');
    assert.ok(['WIN', 'LEARN', 'UNMEASURED', 'SUSPECT'].includes(r.verdict));
  }
  // NaN/negative/string samples are dropped; only the real 200 & 100 survive → measured
  const r = analyze({ cold: [NaN, -3, 'z', 200], warm: [Infinity, 100] });
  assert.equal(r.coldMedian, 200);
  assert.equal(r.warmMedian, 100);
});
