// SECTION: tokenizer
// 第 4 节 预处理：5.1 切词种子表做最长匹配；表外退化为 2 字滑窗；
// 英文 / 数字 / URL 段整体作为独立 token。全程本地，不联网、不引分词库。

import { WORD_SET, MAX_WORD_LEN } from './wordlist.js';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const ALNUM_RE = /[A-Za-z0-9]/;
const ASCII_LINK = '._-+/:@#%&?=~';
export const URL_RE = /^(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/i;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;

export const TOKEN_KINDS = ['word', 'window', 'single', 'ascii', 'number', 'url', 'emoji'];

function trimTrailingPunct(text) {
  const trimmed = text.replace(/[.,;:!?)\]]+$/, '');
  return trimmed.length > 0 ? trimmed : text;
}

export function readAsciiRun(raw, start) {
  let i = start;
  while (i < raw.length) {
    const ch = raw.charAt(i);
    if (ALNUM_RE.test(ch)) {
      i += 1;
      continue;
    }
    if (ASCII_LINK.indexOf(ch) >= 0 && i + 1 < raw.length && ALNUM_RE.test(raw.charAt(i + 1))) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function readEmojiRun(raw, start) {
  let i = start;
  let text = '';
  while (i < raw.length) {
    const codePoint = raw.codePointAt(i);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    if (!EMOJI_RE.test(char)) break;
    text += char;
    i += char.length;
  }
  return { text, end: i };
}

// tokenize(text) -> tokens[] —— 纯函数，无随机
export function tokenize(input) {
  return tokenizeDetailed(input).map((token) => token.text);
}

// 带切分来源的版本，供第 5.3 节覆盖自检使用
export function tokenizeDetailed(input) {
  const raw = input === null || input === undefined ? '' : String(input);
  const tokens = [];
  let i = 0;

  while (i < raw.length) {
    const ch = raw.charAt(i);

    // 1) URL 段整体
    const urlMatch = URL_RE.exec(raw.slice(i));
    if (urlMatch) {
      const url = trimTrailingPunct(urlMatch[0]);
      tokens.push({ text: url, kind: 'url' });
      i += url.length;
      continue;
    }

    // 2) 英文 / 数字整体
    if (ALNUM_RE.test(ch)) {
      const end = readAsciiRun(raw, i);
      const text = raw.slice(i, end);
      const isNumber = /^[0-9]+$/.test(text);
      tokens.push({ text, kind: isNumber ? 'number' : 'ascii' });
      i = end;
      continue;
    }

    // 3) 中文：词表最长匹配 → 2 字滑窗 → 单字
    if (CJK_RE.test(ch)) {
      let matched = null;
      const window = Math.min(MAX_WORD_LEN, raw.length - i);
      for (let len = window; len >= 2; len -= 1) {
        const candidate = raw.substring(i, i + len);
        if (WORD_SET.has(candidate)) {
          matched = candidate;
          break;
        }
      }
      if (matched) {
        tokens.push({ text: matched, kind: 'word' });
        i += matched.length;
        continue;
      }
      const next = i + 1 < raw.length ? raw.charAt(i + 1) : '';
      if (next && CJK_RE.test(next)) {
        tokens.push({ text: raw.substring(i, i + 2), kind: 'window' });
        i += 2;
        continue;
      }
      tokens.push({ text: ch, kind: 'single' });
      i += 1;
      continue;
    }

    // 4) emoji 段整体
    const codePoint = raw.codePointAt(i);
    if (codePoint !== undefined) {
      const char = String.fromCodePoint(codePoint);
      if (EMOJI_RE.test(char)) {
        const run = readEmojiRun(raw, i);
        tokens.push({ text: run.text, kind: 'emoji' });
        i = run.end;
        continue;
      }
    }

    // 5) 标点与空白：留给 extract 的标点统计
    i += 1;
  }

  return tokens;
}
