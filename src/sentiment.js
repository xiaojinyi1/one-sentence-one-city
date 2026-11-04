// SECTION: sentiment
// 第 5.4 节 情绪加权（覆盖 5.2 的「命中一次 ±1」）：强正面 +2 / 一般正面 +1 /
// 强负面 -2 / 一般负面 -1。C1 最长匹配优先、命中即消费，禁止重复计分；
// C2 同一词命中 n 次就计 n 次（「回家回家回家回家」依赖它）。

import { POLARITY_WEIGHTS, MAX_POLARITY_LEN } from './wordlist.js';

export function polarityOf(word) {
  return POLARITY_WEIGHTS.get(word) || 0;
}

// 命中明细：调试面板要显示「词 / 权重 / 累计 score / 最终档位」（第 5.5 节）
export function scoreSentimentDetailed(input) {
  const raw = input === null || input === undefined ? '' : String(input);
  const hits = [];
  let score = 0;
  let i = 0;

  while (i < raw.length) {
    let hitLength = 0;
    let weight = 0;
    const window = Math.min(MAX_POLARITY_LEN, raw.length - i);

    // C1：从最长窗口开始试，命中即消费，不再看它的子串
    for (let len = window; len >= 1; len -= 1) {
      const segment = raw.substring(i, i + len);
      if (POLARITY_WEIGHTS.has(segment)) {
        hitLength = len;
        weight = POLARITY_WEIGHTS.get(segment);
        break;
      }
    }

    if (hitLength > 0) {
      const word = raw.substring(i, i + hitLength);
      score += weight;
      hits.push({ word, weight, score });
      i += hitLength;
    } else {
      i += 1;
    }
  }

  return { score, hits };
}

export function scoreSentiment(input) {
  return scoreSentimentDetailed(input).score;
}
