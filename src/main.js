// SECTION: main
// 第 7 节五段流程：tokenize → extract → plan → build → paint
// 第 8 节冷启动：打开页面就用默认句子（或 ?t= 里的句子）建一次城。

import './style.css';
import { MAX_TEXT, SITE, UI_COPY, UNITS } from './constants.js';
import { fnv1a } from './seed.js';
import { tokenize } from './tokenizer.js';
import { extract } from './features.js';
import { plan } from './plan.js';
import { createStage } from './scene.js';
import { createCityController } from './rebuild.js';
import { createUI } from './ui.js';
import { formatSelfCheck, runSelfCheck } from './selfcheck.js';
import { renderFallback, supportsWebGL } from './fallback.js';
import { scoreSentimentDetailed } from './sentiment.js';
import { POLARITY_SUPPLEMENT } from './wordlist.js';

const app = document.getElementById('app');
const params = new URLSearchParams(window.location.search);
const initialText = (params.get('t') || SITE.defaultText || '').slice(0, MAX_TEXT);

if (!app) {
  // 页面骨架缺失时不做任何事，避免直接抛错白屏
} else if (!supportsWebGL()) {
  renderFallback(app);
} else {
  boot(app, initialText);
}

function boot(root, firstText) {
  let stage = null;
  let wireframe = false;
  let debugView = false;
  let lastCheck = null;
  let lastText = null;
  let lastFeatures = null;

  const isMobile =
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 720;
  // 第 15 节：尊重系统的「减少动态效果」；低端设备关掉真实阴影，只留接触阴影
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowEnd =
    (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
    (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4);
  if (reducedMotion) document.documentElement.classList.add('reduced-motion');

  const ui = createUI(root, {
    onSubmit: (text) => generate(text),
    onExample: (text) => generate(text),
    onShare: () => share(),
    onWireframe: () => {
      wireframe = !wireframe;
      if (stage) stage.setWireframe(wireframe);
    },
    onDebugView: () => {
      debugView = !debugView;
      if (stage) stage.setDebugView(debugView);
    },
    onDebug: () => paintDebug(),
    onExport: () => exportPng(),
    onPlanJson: () => exportPlanJson()
  });

  stage = createStage(ui.canvas, { isMobile, reducedMotion, lowEnd });
  const controller = createCityController(stage);
  // 调试用把手：控制台里可以直接看 scene / plan（第 13 节读数之外的深挖）
  window.__city = { stage, controller };
  stage.start();

  // 第 8 节：边输入边预览，300ms debounce；输入法组字期间不打断
  let debounceHandle = 0;
  function schedulePreview() {
    window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(() => generate(ui.getValue()), 300);
  }
  ui.input.addEventListener('input', (event) => {
    if (event.isComposing) return;
    schedulePreview();
  });
  ui.input.addEventListener('compositionend', schedulePreview);

  function generate(rawInput) {
    const raw = rawInput === null || rawInput === undefined ? '' : String(rawInput);
    const text = raw.trim();

    if (!text) {
      controller.clear();
      lastText = null;
      ui.setStatus('empty', UI_COPY.empty);
      writeUrl('');
      return;
    }

    // 同一句话不重复建城：debounce 与提交、示例卡连点会撞在一起
    if (text === lastText && controller.plan) {
      writeUrl(text);
      return;
    }
    lastText = text;

    if (Array.from(text).length > MAX_TEXT) {
      ui.setStatus('warn', UI_COPY.tooLong);
    } else {
      ui.setStatus('', '');
    }

    ui.setBusy(true);
    ui.setStatus('busy', UI_COPY.generating);

    // 让「城正在升起」先上屏，再做同步的 plan + build
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const tokens = tokenize(text);
          const features = extract(tokens, text);
          const cityPlan = plan(features, fnv1a(text));
          lastFeatures = features;
          controller.apply(cityPlan);
          if (wireframe) stage.setWireframe(true);
          if (debugView) stage.setDebugView(true);
          writeUrl(text);
          if (Array.from(text).length > MAX_TEXT) ui.setStatus('warn', UI_COPY.tooLong);
          else ui.setStatus('', '');
        } catch (error) {
          console.error(error);
          ui.setStatus('error', `城没建起来：${error && error.message ? error.message : error}`);
        } finally {
          ui.setBusy(false);
          if (ui.debugEl && !ui.debugEl.hidden) paintDebug();
        }
      });
    });
  }

  function writeUrl(text) {
    const url = new URL(window.location.href);
    if (text) url.searchParams.set('t', text);
    else url.searchParams.delete('t');
    window.history.replaceState(null, '', url.toString());
  }

  async function share() {
    const url = new URL(window.location.href);
    const text = ui.getValue().trim();
    if (text) url.searchParams.set('t', text);
    try {
      await navigator.clipboard.writeText(url.toString());
      ui.setStatus('ok', UI_COPY.shareCopied);
    } catch (error) {
      window.prompt(UI_COPY.shareCopied, url.toString());
    }
  }

  const SKY_LABEL = { dusk: '黄昏', night: '雨夜', morning: '清晨' };

  function paintDebug() {
    if (!lastCheck) lastCheck = runSelfCheck();
    const cityPlan = controller.plan;
    const city = controller.city;
    const lines = [formatSelfCheck(lastCheck), ''];

    if (cityPlan && lastFeatures) {
      const f = lastFeatures;
      // 第 5.5 节：逐项命中明细（词 / 权重 / 累计 score），以及补词数组内容
      const detail = scoreSentimentDetailed(f.raw);
      const hits = detail.hits.length
        ? detail.hits.map((hit) => `${hit.word} ${hit.weight > 0 ? '+' : ''}${hit.weight}→${hit.score}`).join(' · ')
        : '（没有命中极性词）';
      const supplement = POLARITY_SUPPLEMENT.length
        ? `[${POLARITY_SUPPLEMENT.join(', ')}]（${POLARITY_SUPPLEMENT.length} 条）`
        : '[]（空）';

      lines.push(`句子  ${f.raw}`);
      lines.push(`命中  ${hits}  合计 ${detail.score}`);
      lines.push(`补词  ${supplement}`);
      lines.push(
        `词 ${f.tokenCount} · 平均词长 ${f.avgTokenLen.toFixed(2)} · 最高频 ${f.topToken || '(空)'} ×${f.topFrequency}`
      );
      lines.push(
        `半径 ${cityPlan.radius.toFixed(2)} · 天色 ${SKY_LABEL[cityPlan.sky.key] || cityPlan.sky.key} ${
          cityPlan.sky.sentimentScore > 0 ? '+' : ''
        }${cityPlan.sky.sentimentScore} · 形态 ${cityPlan.shape.mode} / 地块 ${cityPlan.shape.plotSize.toFixed(2)}`
      );
      lines.push(
        `港区 罐 ${cityPlan.stats.tanks} · 烟囱 ${cityPlan.stats.chimneys} · 箱 ${cityPlan.stats.containers} · 码头 ${cityPlan.wharves.length} 件`
      );
      const omitted = cityPlan.stats.omitted || {};
      const omittedTotal = Object.keys(omitted).reduce((sum, key) => sum + (omitted[key] || 0), 0);
      const omittedText = omittedTotal === 0
        ? '0'
        : Object.keys(omitted)
            .filter((key) => omitted[key] > 0)
            .map((key) => `${key} ${omitted[key]}`)
            .join(' / ');
      lines.push(
        `规则 广场 ${cityPlan.plazas.length} · 断口 ${cityPlan.roadGaps.length} · 针 ${cityPlan.needles.length} · 扭塔 ${cityPlan.towers.length} · 围墙 ${cityPlan.walls.length} · 省略 ${omittedText}`
      );
      lines.push(`楼 ${cityPlan.units.length} · 简化形状 ${cityPlan.plotCount} · seed ${cityPlan.seed}`);
      lines.push(`drawcall ${city ? city.drawCalls + 2 : 0} / 12 · 实例上限 ${UNITS.instanceCap}`);
    } else {
      lines.push('还没有城。');
    }

    ui.setDebug(lines.join('\n'));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // 第 12 节：PNG 导出。renderer 必须带 preserveDrawingBuffer，否则 toDataURL 全黑。
  function exportPng() {
    if (!controller.plan) {
      ui.setStatus('warn', '还没有城可以保存。');
      return;
    }
    try {
      stage.renderOnce();
      const source = ui.canvas;
      const out = document.createElement('canvas');
      out.width = source.width;
      out.height = source.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('当前浏览器不支持 2D 画布');
      ctx.drawImage(source, 0, 0);

      // 极简角标：句子 + 站点名，纯文字绘制，不引任何图片或字体文件
      const pad = Math.round(out.width * 0.032);
      const band = Math.round(out.height * 0.14);
      const gradient = ctx.createLinearGradient(0, out.height - band, 0, out.height);
      gradient.addColorStop(0, 'rgba(12,13,17,0)');
      gradient.addColorStop(1, 'rgba(12,13,17,0.88)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, out.height - band, out.width, band);

      const size = Math.max(14, Math.round(out.width * 0.024));
      const base = out.height - pad;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f6f3ea';
      ctx.font = `${size}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif`;
      const sentence = (lastText || SITE.defaultText || '').slice(0, 60);
      ctx.fillText(sentence, pad, base - Math.round(size * 0.5));
      ctx.fillStyle = 'rgba(232,176,75,0.92)';
      ctx.font = `${Math.round(size * 0.72)}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
      ctx.fillText(`${UI_COPY.title} · by ${SITE.author}`, pad, base - Math.round(size * 1.9));

      const url = out.toDataURL('image/png');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `city-${controller.plan.seed}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      ui.setStatus('ok', '图片已保存。');
    } catch (error) {
      console.error(error);
      ui.setStatus('error', `图片没存下来：${error && error.message ? error.message : error}`);
    }
  }

  // 第 13 节：把 CityPlan 原样导出，方便对比「同样一句 → 同一座城」
  function exportPlanJson() {
    if (!controller.plan) return;
    const json = JSON.stringify(controller.plan, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `cityplan-${controller.plan.seed}.json`);
  }

  ui.setValue(firstText);
  generate(firstText);

  // 分享进来的链接如果带 ?t=，中文会被 URL 编码，这里只负责回填输入框
  window.addEventListener('popstate', () => {
    const next = new URLSearchParams(window.location.search).get('t') || SITE.defaultText;
    ui.setValue(next);
    generate(next);
  });
}
