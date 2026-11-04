// SECTION: features
// 第 7 节 第 2 段：extract(tokens) -> TextFeatures（纯函数，无渲染）

import { fnv1a } from './seed.js';
import { scoreSentiment } from './sentiment.js';
import { readAsciiRun, URL_RE } from './tokenizer.js';

const ALNUM_RE = /[A-Za-z0-9]/;
const COMMA_RE = /[，,、]/;
const PERIOD_RE = /[。．.]/;
const QUESTION_RE = /[？?]/;
const EXCLAMATION_RE = /[！!]/;
const QUOTE_RE = /[“”"'‘’「」『』《》〈〉﹁﹂]/;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
const ASCII_ONLY_RE = /^[\x20-\x7E]+$/;
const NUMBER_ONLY_RE = /^[0-9]+$/;
const LETTER_RE = /[A-Za-z]/;

export function countPunct(input) {
  const raw = input === null || input === undefined ? '' : String(input);
  const punct = { comma: 0, period: 0, question: 0, exclamation: 0, quotes: 0 };
  let i = 0;

  while (i < raw.length) {
    // 跳过 URL 段，避免把网址里的 . 和 ? 数成标点
    const urlMatch = URL_RE.exec(raw.slice(i));
    if (urlMatch) {
      i += urlMatch[0].length;
      continue;
    }

    const ch = raw.charAt(i);
    if (ALNUM_RE.test(ch)) {
      // 跳过英文 / 数字整体，避免 "v2.3" 里的点被统计
      i = readAsciiRun(raw, i);
      continue;
    }

    if (QUOTE_RE.test(ch)) punct.quotes += 1;
    else if (COMMA_RE.test(ch)) punct.comma += 1;
    else if (PERIOD_RE.test(ch)) punct.period += 1;
    else if (QUESTION_RE.test(ch)) punct.question += 1;
    else if (EXCLAMATION_RE.test(ch)) punct.exclamation += 1;
    i += 1;
  }

  return punct;
}

function mostFrequent(freq) {
  let topToken = '';
  let topFrequency = 0;
  freq.forEach((count, token) => {
    if (count > topFrequency) {
      topFrequency = count;
      topToken = token;
    }
  });
  return { topToken, topFrequency };
}

export function extract(tokens, rawInput) {
  const list = Array.isArray(tokens) ? tokens : [];
  const raw = rawInput === undefined || rawInput === null ? list.join(' ') : String(rawInput);

  const freq = new Map();
  let charTotal = 0;
  list.forEach((token) => {
    freq.set(token, (freq.get(token) || 0) + 1);
    charTotal += token.length;
  });

  const tokenCount = list.length;
  const avgTokenLen = tokenCount === 0 ? 0 : charTotal / tokenCount;
  const asciiRuns = list.filter(
    (token) => ASCII_ONLY_RE.test(token) && LETTER_RE.test(token)
  );
  const numberRuns = list.filter((token) => NUMBER_ONLY_RE.test(token));
  const emojiRuns = list.filter((token) => EMOJI_RE.test(token));
  const top = mostFrequent(freq);

  return {
    raw,
    tokens: list.slice(),
    freq,
    tokenCount,
    avgTokenLen,
    sentimentScore: scoreSentiment(raw),
    punct: countPunct(raw),
    asciiRuns,
    numberRuns,
    emojiRuns,
    hash: fnv1a(raw),
    topToken: top.topToken,
    topFrequency: top.topFrequency
  };
}
