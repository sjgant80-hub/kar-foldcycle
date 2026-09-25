// kar-foldcycle · capacitypool.mjs — the fold-cycle, MECHANISM 2 (the novel one, the seed does not prove it):
// capacity-pooling in the memory-mind. When a fold EXPIRES (the strand decides 'expire' — see si-didy/
// strand.mjs: applyDecision returns shelf:null), instead of DISCARDING its computed embedding we RELEASE it
// to a content-keyed pool; when a new fold needs an embedding for content we have seen before (it recurred
// after expiry) we ALLOCATE it from the pool — reuse the vector — instead of recomputing the expensive
// embedding. The expired fold's held capacity powers the new fold's creation. The saving is the embedding
// computations avoided when content recurs.
//
// Pure and total: the pool is small mutable state with a bounded size; every method guards its input and
// never throws. The MEASUREMENT (real embedding calls) is in run-mech2.mjs; this is the mechanism + the
// honest verdict, so it can be gated. It is NOT a claim that content-keyed caching is novel in general — the
// novelty is releasing an EXPIRED fold's capacity back into the cycle (un-fold the done -> pool -> re-fold),
// and the honest test is whether that nets when the recycled computation (a real embedding) is expensive.

/** A content-keyed capacity pool. Keyed by exact content, bounded FIFO so it cannot grow without limit. */
export function createPool(opts) {
  const { cap = 10000 } = (opts && typeof opts === 'object') ? opts : {}; // total against null/number/string
  const capN = Number.isInteger(cap) && cap > 0 ? cap : 10000;
  const map = new Map(); // key -> vector
  let releases = 0, allocations = 0, hits = 0, misses = 0;
  return {
    // on strand-EXPIRE: release the fold's held capacity (its embedding) into the pool instead of dropping it
    release(key, vector) {
      if (typeof key !== 'string' || !Array.isArray(vector) || vector.length === 0) return false;
      if (!map.has(key) && map.size >= capN) { map.delete(map.keys().next().value); } // evict oldest, bounded
      map.set(key, vector);
      releases++;
      return true;
    },
    // on a NEW fold: try the pool first (reuse the released capacity), else null so the caller computes fresh
    allocate(key) {
      allocations++;
      if (typeof key === 'string' && map.has(key)) { hits++; return map.get(key); }
      misses++;
      return null;
    },
    has(key) { return typeof key === 'string' && map.has(key); },
    get size() { return map.size; },
    stats() { return { size: map.size, releases, allocations, hits, misses, cap: capN }; },
  };
}

/** The on-expire hook: release capacity ONLY when the strand decision is genuinely 'expire' — a decayed or
 *  held fold keeps its shelf, so its capacity is still live and must NOT be pooled. This is the exact wire to
 *  strand.mjs's decision string. */
export function onExpire(pool, decision, key, vector) {
  if (!pool || typeof pool.release !== 'function') return false;
  if (decision !== 'expire') return false;
  return pool.release(key, vector);
}

/** Verdict: embedding CALLS avoided (Kar's primary metric) and TIME saved, ON (pool) vs OFF (always compute),
 *  on a workload where content recurs. A CONTROL of all-unique content must show ~no saving (nothing recurs);
 *  if it also saved, the measurement is SUSPECT. Empty is UNMEASURED, never a silent pass. */
export function poolVerdict(input) {
  const { callsOff, callsOn, timeOffMs, timeOnMs, controlCallsOff, controlCallsOn, thresholdPct = 20 } =
    (input && typeof input === 'object') ? input : {};
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
  const cOff = n(callsOff), cOn = n(callsOn);
  if (cOff === null || cOn === null || cOff === 0) {
    return { verdict: 'UNMEASURED', why: 'need a non-zero OFF call count and an ON call count — an empty run is not a pass',
      callsSavedPct: null, timeSavedPct: null };
  }
  const callsSavedPct = Math.round((100 * (cOff - cOn)) / cOff);
  const tOff = n(timeOffMs), tOn = n(timeOnMs);
  const timeSavedPct = (tOff !== null && tOn !== null && tOff > 0) ? Math.round((100 * (tOff - tOn)) / tOff) : null;
  let verdict = callsSavedPct >= thresholdPct ? 'WIN' : 'LEARN';
  let why = verdict === 'WIN'
    ? `recycling released capacity avoided ${callsSavedPct}% of embedding calls (${cOff} -> ${cOn})${timeSavedPct !== null ? `, ${timeSavedPct}% of embed time` : ''} on the recurring workload`
    : `only ${callsSavedPct}% of embedding calls avoided — recycling did not net (the pool's overhead vs the recompute it saved)`;
  const out = { verdict, why, callsOff: cOff, callsOn: cOn, callsSavedPct, timeSavedPct, thresholdPct };
  // control sanity: all-unique content should get ~no saving
  const kcOff = n(controlCallsOff), kcOn = n(controlCallsOn);
  if (kcOff !== null && kcOn !== null && kcOff > 0) {
    const controlSavedPct = Math.round((100 * (kcOff - kcOn)) / kcOff);
    out.controlSavedPct = controlSavedPct;
    out.controlHolds = controlSavedPct < thresholdPct;
    if (verdict === 'WIN' && !out.controlHolds) {
      out.verdict = 'SUSPECT';
      out.why = `control (all-unique content) ALSO saved ${controlSavedPct}% — a real recurrence saving should not appear with nothing to recycle; suspect`;
    }
  }
  return out;
}

export default createPool;
