// 第 5.3 节覆盖自检的 Node 运行器。
// 不依赖浏览器、不依赖 three：tokenizer / wordlist / features / rules / plan 全是纯函数，
// 所以 `node selftest.mjs` 就能把断言结果打到终端。
// 浏览器里按 D 看的是同一份 runSelfCheck() 结果。

import { runSelfCheck, formatSelfCheck } from './src/selfcheck.js';
import { SITE, EXAMPLES } from './src/constants.js';
import { tokenize } from './src/tokenizer.js';
import { extract } from './src/features.js';
import { plan } from './src/plan.js';
import { fnv1a } from './src/seed.js';

const result = runSelfCheck();
console.log(formatSelfCheck(result));

console.log('');
console.log('— 示例句对照 —');

const rows = [{ label: 'defaultText', text: SITE.defaultText }].concat(EXAMPLES);
rows.forEach((row) => {
  const tokens = tokenize(row.text);
  const features = extract(tokens, row.text);
  const city = plan(features, fnv1a(row.text));
  console.log(`${row.label}：「${row.text}」`);
  console.log(
    `  tokens=${tokens.length} avgTokenLen=${features.avgTokenLen} 情绪=${features.sentimentScore} 天色=${city.sky.key}`
  );
  console.log(
    `  半径=${city.radius} 形态=${city.shape.mode}(plot ${city.shape.plotSize}) 楼=${city.stats.buildings} 地标=${city.landmark.token}(${city.landmark.floors}层) 罐=${city.stats.tanks} 箱=${city.stats.containers} 针=${city.needles.length} 塔=${city.towers.length}`
  );
  console.log(`  token: ${tokens.join(' / ')}`);
});

console.log('');
console.log(`seed：${rows.map((row) => fnv1a(row.text)).join(', ')}`);

if (result.passed !== result.total) {
  process.exitCode = 1;
  console.log('');
  console.log('有断言未通过：见上面 ✗ 行。');
}
