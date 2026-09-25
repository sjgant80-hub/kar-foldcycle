// kar-foldcycle · capacitypool.test.mjs — every rule falsifiable: a released capacity is reused on
// recurrence, expiry is the ONLY trigger, the pool is bounded, a real recurrence saving reads WIN, a
// control that also saved reads SUSPECT, an empty run reads UNMEASURED, and no garbage throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import createPool, { onExpire, poolVerdict } from './capacitypool.mjs';

test('RELEASE then ALLOCATE — a released capacity is reused on recurrence (hit), a new key misses', () => {
  const p = createPool();
  assert.equal(p.release('fact-a', [1, 2, 3]), true);
  assert.deepEqual(p.allocate('fact-a'), [1, 2, 3], 'recurring content reuses the released vector');
  assert.equal(p.allocate('fact-b'), null, 'unseen content misses → caller computes fresh');
  const s = p.stats();
  assert.equal(s.releases, 1); assert.equal(s.hits, 1); assert.equal(s.misses, 1);
});

test('RELEASE guards — a non-string key or a non-array/empty vector is rejected, never stored', () => {
  const p = createPool();
  assert.equal(p.release(7, [1]), false);
  assert.equal(p.release('k', 'not-a-vector'), false);
  assert.equal(p.release('k', []), false, 'an empty vector is not a real capacity');
  assert.equal(p.size, 0);
});

test('ON-EXPIRE is the ONLY trigger — decay / hold / promote do NOT pool (their capacity is still live)', () => {
  const p = createPool();
  assert.equal(onExpire(p, 'expire', 'k', [1, 2]), true);
  assert.equal(onExpire(p, 'decay', 'k2', [1, 2]), false, 'a decayed fold keeps its shelf — not pooled');
  assert.equal(onExpire(p, 'hold', 'k3', [1, 2]), false);
  assert.equal(onExpire(p, 'promote', 'k4', [1, 2]), false);
  assert.equal(p.size, 1, 'only the expired fold released its capacity');
});

test('BOUNDED — the pool never exceeds its cap (oldest evicted)', () => {
  const p = createPool({ cap: 2 });
  p.release('a', [1]); p.release('b', [2]); p.release('c', [3]);
  assert.equal(p.size, 2, 'cap holds');
  assert.equal(p.allocate('a'), null, 'oldest (a) was evicted');
  assert.deepEqual(p.allocate('c'), [3], 'newest kept');
});

test('VERDICT WIN — a large embedding-call saving on recurring content is scored WIN', () => {
  const r = poolVerdict({ callsOff: 100, callsOn: 40, timeOffMs: 4400, timeOnMs: 1760, controlCallsOff: 100, controlCallsOn: 99 });
  assert.equal(r.verdict, 'WIN');
  assert.equal(r.callsSavedPct, 60);
  assert.equal(r.controlHolds, true);
});

test('VERDICT LEARN — a tiny saving is not dressed up as a win', () => {
  const r = poolVerdict({ callsOff: 100, callsOn: 95 });
  assert.equal(r.verdict, 'LEARN');
  assert.ok(r.callsSavedPct < 20);
});

test('VERDICT SUSPECT — a control that ALSO saved means the measurement is called out', () => {
  const r = poolVerdict({ callsOff: 100, callsOn: 40, controlCallsOff: 100, controlCallsOn: 50 });
  assert.equal(r.verdict, 'SUSPECT');
  assert.match(r.why, /suspect/i);
});

test('VERDICT UNMEASURED — empty or zero-OFF is not a clean pass (anti-narrowing)', () => {
  assert.equal(poolVerdict({ callsOff: 0, callsOn: 0 }).verdict, 'UNMEASURED');
  assert.equal(poolVerdict({ callsOn: 5 }).verdict, 'UNMEASURED');
  assert.equal(poolVerdict().verdict, 'UNMEASURED');
  assert.equal(poolVerdict(null).verdict, 'UNMEASURED');
});

test('VERDICT number-guards — non-number/negative counts are UNMEASURED; callsOn 0 is a 100% WIN', () => {
  assert.equal(poolVerdict({ callsOff: NaN, callsOn: 5 }).verdict, 'UNMEASURED');
  assert.equal(poolVerdict({ callsOff: 10, callsOn: 'x' }).verdict, 'UNMEASURED');
  assert.equal(poolVerdict({ callsOff: -1, callsOn: 5 }).verdict, 'UNMEASURED', 'a negative count is not real');
  const all = poolVerdict({ callsOff: 30, callsOn: 0 });   // everything reused
  assert.equal(all.verdict, 'WIN'); assert.equal(all.callsSavedPct, 100);
});

test('VERDICT threshold boundary — exactly thresholdPct% saved is WIN, just under is LEARN', () => {
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 80 }).verdict, 'WIN');    // 20% == threshold
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 81 }).verdict, 'LEARN');  // 19%
});

test('TIME saved — computed only when both times are real and OFF-time > 0; named in the why iff present', () => {
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 40, timeOffMs: 1000, timeOnMs: 400 }).timeSavedPct, 60);
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 40 }).timeSavedPct, null, 'no times → null');
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 40, timeOnMs: 400 }).timeSavedPct, null, 'OFF-time missing → null');
  assert.equal(poolVerdict({ callsOff: 100, callsOn: 40, timeOffMs: 0, timeOnMs: 0 }).timeSavedPct, null, 'OFF-time 0 → null, no divide');
  assert.match(poolVerdict({ callsOff: 100, callsOn: 40, timeOffMs: 1000, timeOnMs: 400 }).why, /embed time/);
  assert.doesNotMatch(poolVerdict({ callsOff: 100, callsOn: 40 }).why, /embed time/);
});

test('CONTROL field appears only with a valid control; threshold strict → SUSPECT at the boundary', () => {
  assert.equal('controlHolds' in poolVerdict({ callsOff: 100, callsOn: 20 }), false, 'no control → no controlHolds');
  assert.equal('controlHolds' in poolVerdict({ callsOff: 100, callsOn: 20, controlCallsOff: 0, controlCallsOn: 0 }), false, 'zero-OFF control ignored');
  assert.equal('controlHolds' in poolVerdict({ callsOff: 100, callsOn: 20, controlCallsOff: 100 }), false, 'control OFF only ignored');
  const r = poolVerdict({ callsOff: 100, callsOn: 20, controlCallsOff: 100, controlCallsOn: 80, thresholdPct: 20 });
  assert.equal(r.controlSavedPct, 20); assert.equal(r.controlHolds, false); assert.equal(r.verdict, 'SUSPECT');
});

test('WHY text matches the verdict — win vs learn messages not swapped', () => {
  assert.match(poolVerdict({ callsOff: 100, callsOn: 20 }).why, /avoided/);
  assert.match(poolVerdict({ callsOff: 100, callsOn: 98 }).why, /did not net/);
});

test('POOL has() — true for a stored key, false for unseen or non-string', () => {
  const p = createPool(); p.release('k', [1]);
  assert.equal(p.has('k'), true);
  assert.equal(p.has('nope'), false);
  assert.equal(p.has(7), false);
});

test('CAP guard — a non-positive/non-integer cap defaults (not a zero/tiny pool)', () => {
  const z = createPool({ cap: 0 }); z.release('a', [1]); z.release('b', [2]); z.release('c', [3]);
  assert.equal(z.size, 3, 'cap 0 must default, not make a 0/1-slot pool');
  const neg = createPool({ cap: -5 }); neg.release('a', [1]); neg.release('b', [2]);
  assert.equal(neg.size, 2, 'a negative cap defaults too');
});

test('onExpire guards a bad pool — false, never a fake success', () => {
  assert.equal(onExpire(null, 'expire', 'k', [1]), false);
  assert.equal(onExpire({}, 'expire', 'k', [1]), false, 'no release() → refused');
  assert.equal(onExpire({ release: () => true }, 'expire', 'k', [1]), true, 'a real release runs');
});

test('FUZZ — the pool and the verdict never throw on garbage', () => {
  const p = createPool(null);
  for (const g of [null, undefined, 7, {}, [], 'x']) { p.release(g, g); p.allocate(g); onExpire(p, g, g, g); onExpire(g, 'expire', 'k', [1]); }
  for (const g of [null, undefined, 7, 'x', { callsOff: 'a', callsOn: {} }, { callsOff: -5, callsOn: NaN }]) {
    const r = poolVerdict(g);
    assert.ok(['WIN', 'LEARN', 'UNMEASURED', 'SUSPECT'].includes(r.verdict));
  }
});
