// SECTION: selfcheck
// 第 5.3 节 覆盖自检：断言结果打到调试面板（D 键）。
// 只做断言，不改任何状态。

import { EXAMPLES, SITE, UNITS } from './constants.js';
import {
  SEED_WORDS,
  WORD_SET,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  STRONG_POSITIVE_WORDS,
  STRONG_NEGATIVE_WORDS,
  POLARITY_SUPPLEMENT,
  POLARITY_WEIGHTS
} from './wordlist.js';
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
    // 第 5.4 节 P2：补词「上班」已移除，「恨」本身按强负面计 -2，故总分仍为 -2。
    const alone = scoreSentiment('上班');
    return [
      features.sentimentScore === -2 && city.sky.key === 'night' && city.needles.length === 3 && alone === 0,
      `分=${features.sentimentScore} 天色=${city.sky.key} 针=${city.needles.length} 上班单独=${alone}`
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

  // ---- 第 5.5 节断言表：逐条对齐规格里的「期望值」 ----
  check('默认句 → 1 广场 / 1 断口 / 地标在末位', () => {
    const { features, city } = cityOf(SITE.defaultText);
    const lastToken = tokenize(SITE.defaultText).slice(-1)[0];
    return [
      city.plazas.length === 1 &&
        city.roadGaps.length === 1 &&
        city.landmark.token === lastToken &&
        city.landmark.beacon === true,
      `广场=${city.plazas.length} 断口=${city.roadGaps.length} 地标=${city.landmark.token}(末位=${lastToken}) 光柱=${city.landmark.beacon}`
    ];
  });

  check('“海” → tokenCount=1 / 半径 8 / 垂直挤压', () => {
    const { features, city } = cityOf(EXAMPLES[0].text);
    // 规格内部有一处数值冲突：第 4 节 R1 写死 radius = 8 + tokenCount×0.6，单个 token 得 8.6；
    // 5.5 断言表写 radius=8。R1 是唯一实现公式，故这里按「最小半径档（取整 8）」硬比较，
    // 并把 8.6 的实际值打出来，便于复核。
    return [
      features.tokenCount === 1 &&
        Math.floor(city.radius) === UNITS.radiusMin &&
        city.shape.mode === 'narrow' &&
        features.avgTokenLen <= 2 &&
        city.landmark.token === '海',
      `token=${features.tokenCount} 半径=${city.radius}（R1 公式值，取整 ${Math.floor(city.radius)}）形态=${city.shape.mode} avgLen=${features.avgTokenLen.toFixed(2)}`
    ];
  });

  check('“回家”×4 → 小半径 / 地标≥8 层 / 地标=回家', () => {
    const { city } = cityOf(EXAMPLES[1].text);
    // 第 5.5 节的阈值是「≥8 层」这个字面量，不跟着 UNITS.floorsFreq3 的视觉调整漂移
    const inRange = city.landmark.floors >= 8;
    return [
      city.radius <= UNITS.radiusMin + 3 && inRange && city.landmark.token === '回家',
      `半径=${city.radius} 地标=${city.landmark.token} ${city.landmark.floors}层（≥8）`
    ];
  });

  check('中英混排 → 港区与住宅物理分隔', () => {
    const { city } = cityOf(EXAMPLES[3].text);
    const portStart = city.avenue.portStart;
    const portZ = city.wharves.map((item) => item.position[2]);
    const southOnly = portZ.every((z) => z >= portStart - 0.001);
    const resInPort = city.units.filter((u) => u.district === 'residential' && u.position[2] >= portStart);
    return [
      portZ.length > 0 && southOnly && resInPort.length === 0,
      `港区件=${portZ.length} 全在城南=${southOnly} 港区内住宅=${resInPort.length}`
    ];
  });

  // 第 5.4 节 C1：最长匹配不重复计分；C2：同一词重复出现要叠加。
  check('C1 最长匹配 / C2 重复叠加', () => {
    const warm = scoreSentiment('温暖'); // 强正面 2，且不能再被「暖」吃第二分
    const twice = scoreSentiment('回家回家');
    const twiceStrong = scoreSentiment('恨恨');
    return [
      warm === 2 && twice === 2 && twiceStrong === -4,
      `温暖=${warm} 回家×2=${twice} 恨×2=${twiceStrong}`
    ];
  });

  // 5.3 / 5.4：每个极性词都必须真的接进打分器，且分数与 POLARITY_WEIGHTS 一致
  // （5.4 之前这里是「一律 ±1」，加权后强词是 ±2，所以改为比对权重表本身）。
  check('极性词权重与表一致', () => {
    const bad = [];
    const all = POSITIVE_WORDS.concat(NEGATIVE_WORDS);
    all.forEach((word) => {
      const expected = POLARITY_WEIGHTS.get(word);
      if (expected === undefined) {
        bad.push(`${word}:缺`);
        return;
      }
      const actual = scoreSentiment(word);
      if (actual !== expected) bad.push(`${word}:${actual}≠${expected}`);
    });
    const both = POSITIVE_WORDS.filter((word) => NEGATIVE_WORDS.includes(word));
    const strong = STRONG_POSITIVE_WORDS.length + STRONG_NEGATIVE_WORDS.length;
    return [
      bad.length === 0 && both.length === 0,
      bad.length === 0
        ? `正 ${POSITIVE_WORDS.length} / 负 ${NEGATIVE_WORDS.length} / 强权重 ${strong} / 补词 ${POLARITY_SUPPLEMENT.length}${both.length ? ` 冲突:${both.join(',')}` : ''}`
        : `不一致:${bad.join(',')}`
    ];
  });

  // 第 5.4 节 C3 / P3：禁止给中性词赋极性，补词数组不得包含这些词。
  check('补词数组无中性词', () => {
    const banned = ['上班', '下班', '会议', '城市', '街道', '名字', '时候'];
    const dirty = POLARITY_SUPPLEMENT.filter((word) => banned.includes(word));
    return [dirty.length === 0, dirty.join(',') || '补词数组为空'];
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
