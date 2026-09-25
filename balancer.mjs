// kar-foldcycle · balancer.mjs — the fold-cycle, MECHANISM 3 (the hardest; the one that makes it a CYCLE,
// not two independent caches): the balance condition. Mechanism 2's pool has a FIXED cap — if that cap is
// smaller than the working set, released capacity is evicted before its content recurs and the reuse is lost;
// if it is far larger, memory is wasted. The balancer keeps the pool "full enough" by self-tuning RETENTION
// to the observed recurrence: it GROWS the cap when it detects it evicted something that then recurred
// (regret = undersized), and DECAYS the cap when no regret appears for a while (the working set shrank →
// stop holding memory). Bounded [minCap, maxCap]. Pure and total: never throws.
//
// Honest going in (Kar's own prediction): this likely LEARNs — a fixed cap sized to the peak working set is
// often just as good; the balancer only earns its keep when the working set SHIFTS enough that no single
// fixed cap is both big-enough-when-large and lean-when-small. The eval measures exactly that: hit-rate AND
// average memory held, adaptive vs fixed, under a shifting working set.

export function createBalancedPool(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const minCap = Number.isInteger(o.minCap) && o.minCap > 0 ? o.minCap : 8;
  const maxCap = Number.isInteger(o.maxCap) && o.maxCap >= minCap ? o.maxCap : 4096;
  const grow = Number.isFinite(o.grow) && o.grow > 0 ? o.grow : 4;               // cap += grow on regret
  const decayEvery = Number.isInteger(o.decayEvery) && o.decayEvery > 0 ? o.decayEvery : 40; // shrink cadence
  const ghostMax = Number.isInteger(o.ghostMax) && o.ghostMax > 0 ? o.ghostMax : maxCap;
  let cap = minCap;
  const map = new Map();     // key -> vector (the live pool, insertion-ordered for FIFO eviction)
  const ghost = new Map();   // key -> true (recently EVICTED keys, bounded — the "we had it and dropped it" memory)
  let allocations = 0, hits = 0, misses = 0, regret = 0, sinceRegret = 0, capSum = 0, sizeSum = 0, n = 0;

  function evictOldest() {
    const k = map.keys().next().value;
    if (k === undefined) return;
    map.delete(k);
    if (ghost.size >= ghostMax) ghost.delete(ghost.keys().next().value);
    ghost.set(k, true);
  }
  return {
    allocate(key) {
      allocations++; n++; capSum += cap; sizeSum += map.size;
      if (typeof key === 'string' && map.has(key)) { hits++; sinceRegret++; return map.get(key); }
      if (typeof key === 'string' && ghost.has(key)) {
        // ghost hit: we released this once but evicted it before it recurred → undersized → GROW
        regret++; sinceRegret = 0; cap = Math.min(maxCap, cap + grow); ghost.delete(key);
      } else {
        sinceRegret++;
        // no regret for a while → the working set likely shrank → reclaim a little capacity
        if (sinceRegret % decayEvery === 0 && cap > minCap) cap = Math.max(minCap, cap - 1);
      }
      misses++;
      return null;
    },
    release(key, vector) {
      if (typeof key !== 'string' || !Array.isArray(vector) || vector.length === 0) return false;
      if (!map.has(key)) { while (map.size >= cap) evictOldest(); }
      map.set(key, vector);
      return true;
    },
    has(key) { return typeof key === 'string' && map.has(key); },
    get size() { return map.size; },
    get cap() { return cap; },
    stats() {
      return { size: map.size, cap, hits, misses, allocations, regret,
        hitRate: allocations ? hits / allocations : 0,
        avgCap: n ? capSum / n : cap,
        avgMem: n ? sizeSum / n : 0 };
    },
  };
}

/** Verdict: does the adaptive balancer earn its keep against fixed caps under a shifting working set?
 *  WIN only if it holds ~the large fixed cap's hit-rate (within tolPct points) at meaningfully lower average
 *  memory — the "full enough, no more" efficiency the fold-cycle claims. Otherwise LEARN (a fixed cap does as
 *  well or better). UNMEASURED on missing arms. This is the honest test Kar predicted would likely LEARN. */
export function balanceVerdict(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const okArm = (a) => a && typeof a === 'object' && Number.isFinite(a.hitRate) && Number.isFinite(a.avgMem);
  const A = o.adaptive, L = o.fixedLarge, S = o.fixedSmall;
  if (!okArm(A) || !okArm(L)) return { verdict: 'UNMEASURED', why: 'need an adaptive arm and a large-fixed arm, each with hitRate + avgMem' };
  const tol = Number.isFinite(o.tolPct) ? o.tolPct : 3;                   // hit-rate tolerance, in points
  const hitGapPt = Math.round(100 * (L.hitRate - A.hitRate));             // how far adaptive trails big fixed cap (points)
  const memSavedPct = L.avgMem > 0 ? Math.round((100 * (L.avgMem - A.avgMem)) / L.avgMem) : 0;
  const matchesHit = hitGapPt <= tol;
  const leaner = memSavedPct >= 20;
  let verdict, why;
  if (matchesHit && leaner) {
    verdict = 'WIN';
    why = `the balancer held the large fixed cap's hit-rate (within ${hitGapPt}pt) at ${memSavedPct}% less average memory — it tracked the shifting working set, full-enough and no more`;
  } else if (!matchesHit) {
    verdict = 'LEARN';
    why = `the balancer trailed the large fixed cap's hit-rate by ${hitGapPt} points — self-tuning lagged the shifts; a fixed cap sized to the peak working set did better`;
  } else {
    verdict = 'LEARN';
    why = `the balancer matched hit-rate but saved only ${memSavedPct}% memory — not enough to earn the tuning over a plain fixed cap`;
  }
  const out = { verdict, why, adaptiveHitRate: A.hitRate, largeHitRate: L.hitRate, hitGapPt, adaptiveAvgMem: A.avgMem, largeAvgMem: L.avgMem, memSavedPct, tolPct: tol };
  if (okArm(S)) { out.smallHitRate = S.hitRate; out.smallAvgMem = S.avgMem; }
  return out;
}

export default createBalancedPool;
