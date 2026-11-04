// SECTION: rule-R1 / rule-R2 / rule-R3 / rule-R4 / rule-R5 / rule-R6 / rule-R7 / rule-R8
// 第 4 节 核心机制：文本到城市的映射。这一层只做「特征 → 参数」，不做布局、不碰 three。

import { UNITS } from './constants.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// R1 尺度：城区半径 = clamp(8 + tokenCount * 0.6, 8, 26)
export function ruleR1(features) {
  const raw = UNITS.radiusBase + features.tokenCount * UNITS.radiusPerToken;
  return clamp(raw, UNITS.radiusMin, UNITS.radiusMax);
}

// R2 高度：freq1 → 1~2 层；freq2 → 3~6 层；freq>=3 → 8~20 层
export function ruleR2Floors(freq, rng) {
  if (freq >= 3) return rng.int(UNITS.floorsFreq3[0], UNITS.floorsFreq3[1]);
  if (freq === 2) return rng.int(UNITS.floorsFreq2[0], UNITS.floorsFreq2[1]);
  return rng.int(UNITS.floorsFreq1[0], UNITS.floorsFreq1[1]);
}

// R2 地标：最高频词（此处取末位 token，见 R4）高度 ×1.8
export function ruleR2Landmark(floors, floorScale) {
  return Math.max(2, Math.round(floors * UNITS.landmarkScale * floorScale));
}

// R3 标点：逗号广场 / 句号断口 / 问号扭塔 / 感叹号针 / 引号引用区
export function ruleR3(features) {
  const punct = features.punct;
  return {
    plazas: Math.min(punct.comma, UNITS.plazaCap),
    gaps: Math.min(punct.period, UNITS.gapCap),
    twists: Math.min(punct.question, UNITS.twistCap),
    needles: Math.min(punct.exclamation, UNITS.needleCap),
    walls: Math.min(Math.floor(punct.quotes / 2), UNITS.wallCap),
    omitted: {
      plazas: Math.max(0, punct.comma - UNITS.plazaCap),
      gaps: Math.max(0, punct.period - UNITS.gapCap),
      twists: Math.max(0, punct.question - UNITS.twistCap),
      needles: Math.max(0, punct.exclamation - UNITS.needleCap),
      walls: Math.max(0, Math.floor(punct.quotes / 2) - UNITS.wallCap)
    }
  };
}

// R4 顺序定分区：前半句 → 住宅区，后半句 → 商业区，末位 token → 城中心地标
export function ruleR4(tokens) {
  const count = tokens.length;
  if (count === 0) return { splitIndex: 0, landmarkToken: '', residentialTokens: [], commercialTokens: [] };
  const landmarkToken = tokens[count - 1];
  const bodyTokens = tokens.slice(0, count - 1);
  const splitIndex = Math.ceil(count / 2);
  return {
    splitIndex,
    landmarkToken,
    residentialTokens: bodyTokens.slice(0, Math.max(0, splitIndex)),
    commercialTokens: bodyTokens.slice(Math.max(0, splitIndex))
  };
}

// R5 哈希定性格：立面 accent 上 ±8° 色相偏移，屋顶三选一（0.5 / 0.3 / 0.2）
export function ruleR5Hue(rng) {
  return rng.range(-UNITS.hueSpreadDeg, UNITS.hueSpreadDeg);
}

export function ruleR5Roof(rng) {
  const roll = rng.unit();
  if (roll < UNITS.roofFlatWeight) return 'flat';
  if (roll < UNITS.roofFlatWeight + UNITS.roofPitchWeight) return 'pitch';
  return 'tank';
}

// R6 情绪定天色：>= +2 黄昏金 / <= -2 雨夜蓝紫 / 其间清晨灰白
export function ruleR6(features) {
  const score = features.sentimentScore;
  if (score >= UNITS.duskThreshold) return 'dusk';
  if (score <= UNITS.nightThreshold) return 'night';
  return 'morning';
}

// R7 非中文定港区：数字 → 储罐 + 烟囱；URL / 连续 ASCII → 集装箱码头
export function ruleR7(features) {
  return {
    tanks: Math.min(features.numberRuns.length * 2, UNITS.tankCap),
    chimneys: Math.min(features.numberRuns.length * 2, UNITS.tankCap),
    containers: Math.min(features.asciiRuns.length * UNITS.containerPerRun, UNITS.containerCap),
    hasPort: features.numberRuns.length > 0 || features.asciiRuns.length > 0
  };
}

// R8 形态：avgTokenLen <= 2 垂直挤压；>= 4 低密度摊开
export function ruleR8(features) {
  const length = features.avgTokenLen;
  if (length <= 2) {
    return { mode: 'narrow', plotSize: UNITS.plotMin, floorScale: UNITS.floorScaleNarrow };
  }
  if (length >= 4) {
    return { mode: 'wide', plotSize: UNITS.plotMax, floorScale: UNITS.floorScaleWide };
  }
  return {
    mode: 'mid',
    plotSize: (UNITS.plotMin + UNITS.plotMax) / 2,
    floorScale: 1
  };
}
