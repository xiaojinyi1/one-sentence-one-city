// SECTION: main
// 第 7 节五段流程：tokenize → extract → plan → build → paint
// 第 8 节冷启动：打开页面就用默认句子（或 ?t= 里的句子）建一次城。

import './style.css';
import { MAX_TEXT, SITE, UI_COPY } from './constants.js';
import { fnv1a } from './seed.js';
import { tokenize } from './tokenizer.js';
import { extract } from './features.js';
import { plan } from './plan.js';
import { createStage } from './scene.js';
import { createCityController } from './rebuild.js';
import { createUI } from './ui.js';
import { formatSelfCheck, runSelfCheck } from './selfcheck.js';
import { renderFallback, supportsWebGL } from './fallback.js';

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
  let lastCheck = null;
  let lastText = null;

  const isMobile =
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 720;

  const ui = createUI(root, {
    onSubmit: (text) => generate(text),
    onExample: (text) => generate(text),
    onShare: () => share(),
    onWireframe: () => {
      wireframe = !wireframe;
      if (stage) stage.setWireframe(wireframe);
    },
    onDebug: () => paintDebug()
  });

  stage = createStage(ui.canvas, { isMobile });
  const controller = createCityController(stage);
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
          controller.apply(cityPlan);
          if (wireframe) stage.setWireframe(true);
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

  function paintDebug() {
    if (!lastCheck) lastCheck = runSelfCheck();
    const cityPlan = controller.plan;
    const city = controller.city;
    const lines = [formatSelfCheck(lastCheck), ''];

    if (cityPlan) {
      lines.push(`seed  ${cityPlan.seed}`);
      lines.push(
        `半径 ${cityPlan.radius.toFixed(2)} · 天色 ${cityPlan.sky.key} (${cityPlan.sky.sentimentScore})`
      );
      lines.push(
        `形态 ${cityPlan.shape.mode} · 地块 ${cityPlan.shape.plotSize.toFixed(2)} · 楼 ${cityPlan.units.length}`
      );
      lines.push(
        `港区 罐 ${cityPlan.stats.tanks} / 烟囱 ${cityPlan.stats.chimneys} / 箱 ${cityPlan.stats.containers}`
      );
      lines.push(
        `地标 ${cityPlan.landmark.token || '(空)'} ${cityPlan.landmark.floors} 层 · 针 ${cityPlan.needles.length} · 扭塔 ${cityPlan.towers.length}`
      );
      lines.push(`drawcall ${city ? city.drawCalls + 2 : 0}（含地面与天空）`);
    } else {
      lines.push('还没有城。');
    }

    ui.setDebug(lines.join('\n'));
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
