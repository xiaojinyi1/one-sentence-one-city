// SECTION: selfcheck
// 第 5.3 节 覆盖自检：断言结果打到调试面板（D 键）。
// 只做断言，不改任何状态。

import { EXAMPLES, SITE, UNITS } from './constants.js';
import { SEED_WORDS, WORD_SET, POSITIVE_WORDS, NEGATIVE_WORDS, POLARITY_SUPPLEMENT } from './wordlist.js';
import { scoreSentiment } from './sentiment.js';
import { tokenize, tokenizeDetailed } from './tokenizer.js';
import { extract } from './features.js';
import { plan } from './plan.js';
import { ruleR1, ruleR3, ruleR8 } from './rules.js';
import { fnv1a } from './seed.js';

function cityOf(text) {
  const tokens = tokenize(text);
  const features = extract(tokens, text);
  return { tokens, features, city: plan(features, fnv1a(text)) };
}

function countKind(city, kind) {
  return city.wharves.filter((item) => item.kind === kind).length;
}

export function runSelfCheck() {
  const items = [];
  const check = (name, fn) => {
    try {
      const result = fn();
      if (Array.isArray(result)) items.push({ name, ok: Boolean(result[0]), detail: String(result[1]) });
      else items.push({ name, ok: Boolean(result), detail: '' });
    } catch (error) {
      items.push({ name, ok: false, detail: String(error && error.message ? error.message : error) });
    }
  };

  // ---- 第 5.1 / 5.2 节：词表 ----
  check('词表规模', () => [SEED_WORDS.length >= 90, `${SEED_WORDS.length} 条`]);

  check('词表无重复', () => {
    const seen = new Set();
    const dup = [];
    SEED_WORDS.forEach((word) => {
      if (seen.has(word)) dup.push(word);
      seen.add(word);
    });
    return [dup.length === 0, dup.join(', ') || '无重复'];
  });

  check('词表全部可被分词命中', () => {
    const miss = SEED_WORDS.filter((word) => !tokenize(word).includes(word));
    return [miss.length === 0, miss.join(', ') || '全部命中'];
  });

  // ---- 第 5.3 节：示例句的 token 必须被 5.1 命中或被滑窗切分 ----
  check('示例 token 全部可解释', () => {
    const texts = [SITE.defaultText].concat(EXAMPLES.map((item) => item.text));
    const broken = [];
    texts.forEach((text) => {
      tokenizeDetailed(text).forEach((token) => {
        const ok =
          WORD_SET.has(token.text) ||
          token.kind === 'window' ||
          token.kind === 'single' ||
          token.kind === 'ascii' ||
          token.kind === 'number' ||
          token.kind === 'url' ||
          token.kind === 'emoji';
        if (!ok) broken.push(`${text} → ${token.text}`);
      });
    });
    return [broken.length === 0, broken.join(' / ') || '全部可解释'];
  });

  // ---- 第 5.3 节：示例句的预期天色 ----
  check('默认句 → 黄昏', () => {
    const { features, city } = cityOf(SITE.defaultText);
    return [features.sentimentScore === 2 && city.sky.key === 'dusk', `分=${features.sentimentScore} 天色=${city.sky.key}`];
  });

  check('“海” → 单 token / 清晨', () => {
    const { tokens, features, city } = cityOf(EXAMPLES[0].text);
    return [
      tokens.length === 1 && features.sentimentScore === 1 && city.sky.key === 'morning',
      `tokens=${tokens.length} 分=${features.sentimentScore} 天色=${city.sky.key}`
    ];
  });

  check('“回家”×4 → 高频 / 黄昏 / 地标≥8 层', () => {
    const { tokens, features, city } = cityOf(EXAMPLES[1].text);
    return [
      tokens.length === 4 && features.topFrequency === 4 && city.sky.key === 'dusk' && city.landmark.floors >= 8,
      `tokens=${tokens.length} 最高频=${features.topFrequency} 天色=${city.sky.key} 地标=${city.landmark.floors}层`
    ];
  });

  check('“我恨上班！！！” → 雨夜 / 三根针', () => {
    const { features, city } = cityOf(EXAMPLES[2].text);
    // 「恨」-1 加补词「上班」-1 = -2 → 雨夜；补词单列在 POLARITY_SUPPLEMENT 里。
    return [
      features.sentimentScore === -2 && city.sky.key === 'night' && city.needles.length === 3,
      `分=${features.sentimentScore} 天色=${city.sky.key} 针=${city.needles.length}`
    ];
  });

  check('中英混排 → 港区 / 集装箱', () => {
    const { features, city } = cityOf(EXAMPLES[3].text);
    return [
      features.asciiRuns.length >= 1 &&
        features.numberRuns.length >= 1 &&
        countKind(city, 'container') > 0 &&
        countKind(city, 'tank') > 0,
      `ascii=${features.asciiRuns.length} 数字=${features.numberRuns.length} 箱=${countKind(city, 'container')} 罐=${countKind(city, 'tank')}`
    ];
  });

  check('情绪最长匹配不重复计分', () => {
    const a = scoreSentiment('温暖');
    const b = scoreSentiment('回家回家');
    return [a === 1 && b === 2, `温暖=${a} 回家×2=${b}`];
  });

  // 5.3 要求「极性词都在 5.2 内」：这里验证 5.2 的每一个词都真的接进了打分器，
  // 并且符号正确——表里漏词、符号写反都会在这一条暴露。补词单列，条数单独报告。
  check('极性词全部接入打分器', () => {
    const bad = [];
    POSITIVE_WORDS.forEach((word) => {
      if (scoreSentiment(word) !== 1) bad.push(`+${word}`);
    });
    const negativeAll = NEGATIVE_WORDS.concat(POLARITY_SUPPLEMENT);
    negativeAll.forEach((word) => {
      if (scoreSentiment(word) !== -1) bad.push(`-${word}`);
    });
    const both = POSITIVE_WORDS.filter((word) => negativeAll.includes(word));
    return [
      bad.length === 0 && both.length === 0,
      bad.length === 0
        ? `正 ${POSITIVE_WORDS.length} / 负 ${NEGATIVE_WORDS.length} + 补词 ${POLARITY_SUPPLEMENT.length}${both.length ? ` 冲突:${both.join(',')}` : ''}`
        : `未接上:${bad.join(',')}`
    ];
  });

  // ---- 第 4 节：规则边界 ----
  check('R1 clamp(8, 26)', () => {
    const single = ruleR1(extract([], ''));
    const many = [];
    for (let i = 0; i < 100; i += 1) many.push('字');
    const big = ruleR1(extract(many, many.join('')));
    return [single === UNITS.radiusMin && big === UNITS.radiusMax, `${single} / ${big}`];
  });

  check('R3 上限生效', () => {
    const raw = '字' + '，'.repeat(20) + '。'.repeat(10) + '?'.repeat(10) + '!'.repeat(20);
    const marks = ruleR3(extract(tokenize(raw), raw));
    return [
      marks.plazas === UNITS.plazaCap &&
        marks.gaps === UNITS.gapCap &&
        marks.twists === UNITS.twistCap &&
        marks.needles === UNITS.needleCap,
      `广场=${marks.plazas} 断口=${marks.gaps} 扭=${marks.twists} 针=${marks.needles}`
    ];
  });

  check('R8 三档形态', () => {
    const narrow = ruleR8({ avgTokenLen: 1.4 });
    const mid = ruleR8({ avgTokenLen: 3 });
    const wide = ruleR8({ avgTokenLen: 5 });
    return [narrow.mode === 'narrow' && mid.mode === 'mid' && wide.mode === 'wide', `${narrow.mode}/${mid.mode}/${wide.mode}`];
  });

  check('同句同种 → 同一座城', () => {
    const a = JSON.stringify(cityOf(SITE.defaultText).city);
    const b = JSON.stringify(cityOf(SITE.defaultText).city);
    return [a === b, a === b ? '两次完全一致' : '两次不一致'];
  });

  check('地标唯一且在原点', () => {
    const { city } = cityOf(EXAMPLES[3].text);
    return [
      city.landmark.position[0] === 0 && city.landmark.position[2] === 0 && city.landmark.beacon === true,
      `地标=${city.landmark.token}`
    ];
  });

  const passed = items.filter((item) => item.ok).length;
  return { passed, total: items.length, items };
}

export function formatSelfCheck(result) {
  const lines = result.items.map((item) => `${item.ok ? '✓' : '✗'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  return [`自检 ${result.passed}/${result.total}`, ...lines].join('\n');
}
