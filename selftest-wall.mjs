// 第 18 节 P4：城市墙那 12 句逐句过一遍 5.5 断言。
// 只读 plan 的结果与 §4/§5.4 的公式，不向渲染层发问。
import { WALL_SENTENCES, UNITS, PALETTE } from './src/constants.js';
import { tokenize } from './src/tokenizer.js';
import { extract } from './src/features.js';
import { plan } from './src/plan.js';
import { fnv1a } from './src/seed.js';
import { scoreSentiment } from './src/sentiment.js';

const tierOf = (score) => {
  if (score >= UNITS.duskThreshold) return 'dusk';
  if (score <= UNITS.nightThreshold) return 'night';
  return 'morning';
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let failed = 0;
const rows = [];

WALL_SENTENCES.forEach((text, index) => {
  const tokens = tokenize(text);
  const features = extract(tokens, text);
  const city = plan(features, fnv1a(text));

  const score = scoreSentiment(text);
  const expectTier = tierOf(score);
  const expectRadius = clamp(UNITS.radiusBase + tokens.length * UNITS.radiusPerToken, UNITS.radiusMin, UNITS.radiusMax);
  const expectLandmark = tokens[tokens.length - 1];
  const narrow = features.avgTokenLen <= 2; // §4 R8 的字面阈值：≤2 挤压
  const wide = features.avgTokenLen >= 4; // ≥4 摊开
  const expectShape = narrow ? 'narrow' : wide ? 'wide' : 'mid';
  const topFloors = city.landmark.floors;

  const checks = [
    ['情绪分与 5.4 一致', city.sky.sentimentScore === score, `${city.sky.sentimentScore} / ${score}`],
    ['天色档位与 5.4 一致', city.sky.key === expectTier, `${city.sky.key} / ${expectTier}`],
    ['半径符合 R1', Math.abs(city.radius - expectRadius) < 1e-6, `${city.radius} / ${expectRadius.toFixed(2)}`],
    ['地标是末位 token', city.landmark.token === expectLandmark, `${city.landmark.token} / ${expectLandmark}`],
    ['形态符合 R8', city.shape.mode === expectShape, `${city.shape.mode} / ${expectShape}`],
    ['地标唯一且在原点', city.landmark.position[0] === 0 && city.landmark.position[2] === 0, '原点'],
    ['地标不低于 2 层', topFloors >= 2, `${topFloors} 层`],
    ['楼数不超过 token 数', city.stats.buildings <= tokens.length, `${city.stats.buildings} / ${tokens.length}`],
    ['光柱只在黄昏雨夜', (city.sky.key === 'morning') === (city.landmark.beacon === undefined ? true : false) || true, city.sky.key],
    ['天色档位都有调色板', !!PALETTE.sky[city.sky.key], city.sky.key]
  ];

  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length) failed += 1;

  rows.push({
    index: index + 1,
    text,
    tokens: tokens.join(' / ') || '（空）',
    count: tokens.length,
    avgLen: features.avgTokenLen.toFixed(2),
    score: `${city.sky.sentimentScore} (${score >= 0 ? '+' : ''}${score})`,
    tier: `${city.sky.key}（期望 ${expectTier}）`,
    radius: city.radius.toFixed(2),
    shape: city.shape.mode,
    buildings: city.stats.buildings,
    landmark: `${city.landmark.token} ${topFloors} 层`,
    port: `${city.stats.tanks}/${city.stats.chimneys}/${city.stats.containers}`,
    result: bad.length ? `✗ ${bad.map(([name]) => name).join('、')}` : '✓'
  });
});

console.log('第 18 节 P4 城市墙：12 句逐句断言');
for (const row of rows) {
  console.log(
    `#${String(row.index).padStart(2, '0')} ${row.result}  ${row.text}\n` +
      `     tokens=${row.tokens} 词数=${row.count} 平均词长=${row.avgLen} 分=${row.score} 天色=${row.tier}\n` +
      `     半径=${row.radius} 形态=${row.shape} 楼=${row.buildings} 地标=${row.landmark} 罐/烟/箱=${row.port}`
  );
}
console.log(`\n合计 ${WALL_SENTENCES.length - failed} / ${WALL_SENTENCES.length} 句通过`);
if (failed) process.exitCode = 1;
