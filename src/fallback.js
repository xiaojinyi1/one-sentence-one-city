// SECTION: fallback
// 第 2 节红线：WebGL 不可用时不许白屏。降级为说明页 + 映射规则文字表格。

import { EXAMPLES, SITE, UI_COPY } from './constants.js';

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    return true;
  } catch (error) {
    return false;
  }
}

const RULE_ROWS = [
  ['R1', '句子长度', '城区半径 = clamp(8 + 词数 × 0.6, 8, 26)'],
  ['R2', '词频', '出现 1 次 1~2 层；2 次 3~6 层；3 次以上 8~20 层；最高频的词是全城唯一地标，高 ×1.8'],
  ['R3', '标点', '逗号→小广场带喷泉；句号→主干道断口带斑马线；问号→绕 Y 轴扭转的塔；感叹号→细高针状塔；引号/书名号成对→围墙引用区'],
  ['R4', '顺序', '前半句是住宅区，后半句是商业区，末位的词立在城中心当地标'],
  ['R5', '性格', '立面色相在基色上偏 ±8°；屋顶在平顶 / 坡顶 / 水箱+天线之间按 0.5 / 0.3 / 0.2 分配；窗灯随机点亮'],
  ['R6', '情绪', '情绪分 ≥ +2 是黄昏金；≤ -2 是雨夜蓝紫；其间是清晨灰白'],
  ['R7', '非中文', '数字→储罐加烟囱；网址与连续英文→集装箱码头；港区固定在城南，与住宅区隔开'],
  ['R8', '平均词长', '平均 ≤ 2 字垂直挤压；≥ 4 字低密度摊开']
];

export function renderFallback(app) {
  const rows = RULE_ROWS.map(
    (row) =>
      `<tr><th scope="row">${row[0]}</th><td>${row[1]}</td><td>${row[2]}</td></tr>`
  ).join('');

  const examples = EXAMPLES.map(
    (example) =>
      `<li><span class="fb-label">${example.label}</span><code>${example.text}</code></li>`
  ).join('');

  app.innerHTML = `
    <main class="fallback">
      <h1 class="title">${UI_COPY.title}</h1>
      <p class="subtitle">${UI_COPY.subtitle}</p>
      <p class="fb-note">
        这台设备没有可用的 WebGL，城市画不出来。但「一句话 → 一座城」的规则不受影响，下面就是完整的映射表。
      </p>

      <table class="rules">
        <caption>第 4 节 映射规则</caption>
        <thead><tr><th>规则</th><th>触发</th><th>结果</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>试试这几句</h2>
      <ul class="fb-examples">${examples}</ul>

      <p class="privacy">${UI_COPY.privacy}</p>
      <p class="author">by ${SITE.author}</p>
    </main>
  `;
}
