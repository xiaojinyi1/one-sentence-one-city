// SECTION: sentiment
// 第 5.2 节 情绪极性表打分：命中一次 +1 / -1，重复叠加。
// 采用「最长优先、命中即消费」的扫描，避免「温暖」被同时算成「温暖」和「暖」两分。

import { POSITIVE_SET, NEGATIVE_SET, MAX_POLARITY_LEN } from './wordlist.js';

export function polarityOf(word) {
  if (POSITIVE_SET.has(word)) return 1;
  if (NEGATIVE_SET.has(word)) return -1;
  return 0;
}

export function scoreSentiment(input) {
  const raw = input === null || input === undefined ? '' : String(input);
  let score = 0;
  let i = 0;

  while (i < raw.length) {
    let hit = null;
    let sign = 0;
    const window = Math.min(MAX_POLARITY_LEN, raw.length - i);

    for (let len = window; len >= 1; len -= 1) {
      const segment = raw.substring(i, i + len);
      if (POSITIVE_SET.has(segment)) {
        hit = segment;
        sign = 1;
        break;
      }
      if (NEGATIVE_SET.has(segment)) {
        hit = segment;
        sign = -1;
        break;
      }
    }

    if (hit) {
      score += sign;
      i += hit.length;
    } else {
      i += 1;
    }
  }

  return score;
}
