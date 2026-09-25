// kar-foldcycle · balancer.test.mjs — every rule falsifiable: the cap grows on a ghost-hit (evicted then
// recurred = undersized), decays when no regret appears, stays bounded; a released capacity is reused; and
// the verdict is honest — WIN only when the balancer holds the big cap's hit-rate at less memory, else LEARN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import createBalancedPool, { balanceVerdict } from './balancer.mjs';

test('RELEASE / ALLOCATE — a released capacity is reused (hit); a fixed min=max pool never adapts', () => {
  const p = createBalancedPool({ minCap: 15, maxCap: 15 });
  assert.equal(p.release('a', [1]), true);
  assert.deepEqual(p.allocate('a'), [1]);
  assert.equal(p.allocate('b'), null);
  assert.equal(p.cap, 15, 'min==max → cap is pinned, no adaptation');
});

test('CAP GROWS on a ghost-hit — evicting something that then recurs signals undersized', () => {
  const p = createBalancedPool({ minCap: 2, maxCap: 20, grow: 3 });
  p.release('a', [1]); p.release('b', [1]);          // pool full at cap 2 {a,b}
  p.release('c', [1]);                                // evicts oldest a → a is a ghost, pool {b,c}
  assert.equal(p.has('a'), false, 'a was evicted');
  const before = p.cap;
  assert.equal(p.allocate('a'), null, 'a is gone from the live pool → miss');
  assert.equal(p.cap, before + 3, 'but a was a GHOST (we had it, evicted it) → regret → cap grew');
});

test('CAP DECAYS when no regret appears — the working set shrank, reclaim memory', () => {
  const p = createBalancedPool({ minCap: 2, maxCap: 50, grow: 10, decayEvery: 3 });
  // first grow the cap via a ghost-hit
  p.release('a', [1]); p.release('b', [1]); p.release('c', [1]); // evict a → ghost
  p.allocate('a');                                               // ghost hit → cap 2+10=12
  const grown = p.cap; assert.ok(grown >= 12);
  // now only fresh misses (no ghost hits) → every decayEvery misses, cap drops by 1
  p.allocate('z1'); p.allocate('z2'); p.allocate('z3');          // 3rd fresh miss → decay one
  assert.ok(p.cap < grown, 'no regret for a while → cap decays back down');
});

test('BOUNDED — cap never exceeds maxCap nor drops below minCap', () => {
  const p = createBalancedPool({ minCap: 4, maxCap: 6, grow: 100 });
  p.release('a', [1]); p.release('b', [1]); p.release('c', [1]); p.release('d', [1]); p.release('e', [1]);
  // force ghost hits repeatedly to push cap up
  for (const k of ['a', 'b', 'c']) p.allocate(k);
  assert.ok(p.cap <= 6, 'cap capped at maxCap despite big grow');
  assert.ok(p.cap >= 4, 'cap never below minCap');
});

test('RELEASE guards — non-string key / non-array / empty vector rejected', () => {
  const p = createBalancedPool();
  assert.equal(p.release(7, [1]), false);
  assert.equal(p.release('k', 'x'), false);
  assert.equal(p.release('k', []), false);
  assert.equal(p.size, 0);
});

test('STATS — hitRate and avgMem reflect the run', () => {
  const p = createBalancedPool({ minCap: 10, maxCap: 10 });
  p.release('a', [1]); p.allocate('a'); p.allocate('a'); p.allocate('b'); // 2 hits, 1 miss of 3 allocs
  const s = p.stats();
  assert.equal(s.hits, 2); assert.equal(s.misses, 1);
  assert.ok(Math.abs(s.hitRate - 2 / 3) < 1e-9);
  assert.ok(s.avgMem >= 0);
});

test('VERDICT WIN — adaptive holds the big cap hit-rate at much less memory', () => {
  const r = balanceVerdict({ adaptive: { hitRate: 0.60, avgMem: 12 }, fixedLarge: { hitRate: 0.62, avgMem: 50 }, fixedSmall: { hitRate: 0.40, avgMem: 15 } });
  assert.equal(r.verdict, 'WIN');
  assert.ok(r.memSavedPct >= 20);
});

test('VERDICT LEARN — adaptive that trails hit-rate, or matches without saving memory, is not a win', () => {
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.40, avgMem: 12 }, fixedLarge: { hitRate: 0.62, avgMem: 50 } }).verdict, 'LEARN', 'trails hit-rate');
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.61, avgMem: 46 }, fixedLarge: { hitRate: 0.62, avgMem: 50 } }).verdict, 'LEARN', 'matches but ~no memory saved');
});

test('VERDICT UNMEASURED — missing arms are not a silent pass', () => {
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.6, avgMem: 12 } }).verdict, 'UNMEASURED');
  assert.equal(balanceVerdict({}).verdict, 'UNMEASURED');
  assert.equal(balanceVerdict(null).verdict, 'UNMEASURED');
});

test('CONFIG GUARDS — invalid options fall back to defaults (identical run to an explicit-default pool)', () => {
  const trace = []; for (let i = 0; i < 60; i++) trace.push('k' + (i % 12)); // recurring working set of 12
  const run = (p) => { for (const k of trace) { p.allocate(k); p.release(k, [1]); } return p.stats(); };
  const invalid = run(createBalancedPool({ minCap: 0, maxCap: 0, grow: 0, decayEvery: 0, ghostMax: 0 }));
  const deflt = run(createBalancedPool({ minCap: 8, maxCap: 4096, grow: 4, decayEvery: 40, ghostMax: 4096 }));
  assert.deepEqual({ h: invalid.hits, m: invalid.misses, c: invalid.cap }, { h: deflt.hits, m: deflt.misses, c: deflt.cap },
    'an all-invalid opts pool must behave EXACTLY like the defaults — any leaked bad value diverges');
  // a non-integer minCap is invalid → default 8 (cap starts at minCap)
  assert.equal(createBalancedPool({ minCap: 2.5 }).cap, 8);
  assert.equal(createBalancedPool({ minCap: 0 }).cap, 8);
  assert.equal(createBalancedPool({ minCap: 5 }).cap, 5, 'a valid minCap is honoured');
});

test('MAXCAP equal-to-minCap is honoured (cap cannot grow past it)', () => {
  const p = createBalancedPool({ minCap: 5, maxCap: 5, grow: 100 });
  p.release('a', [1]); p.release('b', [1]); p.release('c', [1]); p.release('d', [1]); p.release('e', [1]); p.release('f', [1]);
  for (const k of ['a', 'b', 'c']) p.allocate(k); // ghost hits try to grow cap
  assert.equal(p.cap, 5, 'maxCap == minCap must pin the cap, not fall through to the default 4096');
});

test('GHOST is bounded — an old evicted key is forgotten, so its late recurrence is a plain miss (no regret)', () => {
  const p = createBalancedPool({ minCap: 1, maxCap: 10, grow: 5, ghostMax: 1 });
  p.release('a', [1]);   // pool {a}
  p.release('b', [1]);   // evict a → ghost {a}
  p.release('c', [1]);   // evict b → ghost bounded at 1 → a forgotten, ghost {b}
  const capBefore = p.cap;
  p.allocate('a');       // a is gone from pool AND forgotten from ghost → plain miss, NO regret
  assert.equal(p.cap, capBefore, 'a forgotten ghost must not trigger a cap grow');
  p.allocate('b');       // b is still a ghost → regret → grow
  assert.ok(p.cap > capBefore, 'a remembered ghost does trigger a grow');
});

test('DECAY cadence is exact — cap drops by one per decayEvery no-regret misses, not every miss', () => {
  const p = createBalancedPool({ minCap: 2, maxCap: 50, grow: 20, decayEvery: 4 });
  p.release('a', [1]); p.release('b', [1]); p.release('c', [1]); // evict a → ghost
  p.allocate('a'); // ghost hit → cap = 2 + 20 = 22, sinceRegret = 0
  const grown = p.cap;
  p.allocate('z1'); p.allocate('z2'); p.allocate('z3'); // 3 fresh misses, sinceRegret 1,2,3 → no decay yet (4 not hit)
  assert.equal(p.cap, grown, 'no decay before decayEvery misses');
  p.allocate('z4'); // 4th → sinceRegret 4, 4%4===0 → decay by exactly 1
  assert.equal(p.cap, grown - 1, 'exactly one decay at the interval, not more');
});

test('POOL has() — true for a stored key, false for unseen or non-string', () => {
  const p = createBalancedPool(); p.release('k', [1]);
  assert.equal(p.has('k'), true); assert.equal(p.has('nope'), false); assert.equal(p.has(7), false);
});

test('VERDICT okArm — a null/garbage arm is UNMEASURED, never a throw', () => {
  assert.equal(balanceVerdict({ adaptive: null, fixedLarge: { hitRate: 0.5, avgMem: 5 } }).verdict, 'UNMEASURED');
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.5, avgMem: 5 }, fixedLarge: 7 }).verdict, 'UNMEASURED');
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.5, avgMem: 5 }, fixedLarge: { hitRate: 'x', avgMem: 5 } }).verdict, 'UNMEASURED');
});

test('DECAY-EVERY guard — an invalid decayEvery (0) defaults to 40, not "never decay"', () => {
  const run = (decayEvery) => {
    const p = createBalancedPool({ minCap: 2, maxCap: 50, grow: 20, decayEvery });
    p.release('a', [1]); p.release('b', [1]); p.release('c', [1]); // evict a → ghost
    p.allocate('a');                                                // ghost hit → cap grows, sinceRegret=0
    for (let i = 0; i < 44; i++) p.allocate('fresh' + i);           // 44 no-regret misses → default decays at 40
    return p.cap;
  };
  assert.equal(run(0), run(40), 'decayEvery:0 must fall back to the default 40, not leak a never-decaying 0');
});

test('VERDICT memory divide-guard — fixedLarge avgMem 0 gives 0%, not NaN/Infinity', () => {
  const r = balanceVerdict({ adaptive: { hitRate: 0.5, avgMem: 0 }, fixedLarge: { hitRate: 0.5, avgMem: 0 } });
  assert.equal(r.memSavedPct, 0);
  assert.ok(Number.isFinite(r.memSavedPct));
});

test('VERDICT thresholds — hit-gap tolerance and memory-saving cutoff are strict', () => {
  // adaptive trails by exactly tol (3pt) and saves exactly 20% → WIN (both cutoffs are inclusive)
  const w = balanceVerdict({ adaptive: { hitRate: 0.59, avgMem: 40 }, fixedLarge: { hitRate: 0.62, avgMem: 50 } });
  assert.equal(w.hitGapPt, 3); assert.equal(w.memSavedPct, 20); assert.equal(w.verdict, 'WIN');
  // trails by 4pt (> tol) → LEARN even though memory saved
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.58, avgMem: 40 }, fixedLarge: { hitRate: 0.62, avgMem: 50 } }).verdict, 'LEARN');
  // matches hit but saves only 19% → LEARN
  assert.equal(balanceVerdict({ adaptive: { hitRate: 0.62, avgMem: 40.5 }, fixedLarge: { hitRate: 0.62, avgMem: 50 } }).verdict, 'LEARN');
});

test('FUZZ — pool and verdict never throw on garbage', () => {
  const p = createBalancedPool(null);
  for (const g of [null, undefined, 7, {}, [], 'x']) { p.allocate(g); p.release(g, g); p.has(g); }
  for (const g of [null, 7, 'x', { adaptive: 'a' }, { adaptive: { hitRate: NaN, avgMem: 1 }, fixedLarge: {} }]) {
    assert.ok(['WIN', 'LEARN', 'UNMEASURED'].includes(balanceVerdict(g).verdict));
  }
});
