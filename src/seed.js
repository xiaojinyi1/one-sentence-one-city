// SECTION: seed
// 第 6 节 确定性：句子字符串 → 32bit 非加密哈希（FNV-1a 风格），
// 再由哈希初始化自写 PRNG（mulberry32 风格）。全城随机只允许来自这里。

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(text) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(seed >>> 0);

  function unit() {
    return next();
  }

  function range(min, max) {
    return min + (max - min) * next();
  }

  function int(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    return lo + Math.floor(next() * (hi - lo + 1));
  }

  function pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(next() * list.length)];
  }

  function chance(probability) {
    return next() < probability;
  }

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  return { unit, range, int, pick, chance, shuffled };
}
