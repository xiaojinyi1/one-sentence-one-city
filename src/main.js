// SECTION: main
// 第 7 节五段流程：tokenize → extract → plan → build → paint
// 第 8 节冷启动：打开页面就用默认句子（或 ?t= 里的句子）建一次城。

import './style.css';
import {
  EXAMPLES,
  MAX_TEXT,
  SITE,
  UI_COPY,
  UNITS,
  VISUAL_DIFF,
  WALL_SENTENCES
} from './constants.js';
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
// 第 18 节 P1：t1 + t2 同时存在时，打开就是对比视图；只有 t 时行为不变
const initialDual =
  params.get('t1') && params.get('t2')
    ? {
        a: params.get('t1').slice(0, MAX_TEXT),
        b: params.get('t2').slice(0, MAX_TEXT)
      }
    : null;

if (!app) {
  // 页面骨架缺失时不做任何事，避免直接抛错白屏
} else if (!supportsWebGL()) {
  renderFallback(app);
} else {
  boot(app, initialText, initialDual);
}

function boot(root, firstText, firstDual) {
  let stage = null;
  let wireframe = false;
  let debugView = false;
  let lastCheck = null;
  let lastText = null;
  let lastFeatures = null;
  // 第 18 节 P1 / P4：视图状态。默认永远是单城主视图。
  let view = 'single';
  let dualText = { a: '', b: '' };
  let dualTimer = { a: 0, b: 0 };
  let wallImages = [];

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
    onPlanJson: () => exportPlanJson(),
    onDualOpen: () => openDualView(),
    onDualClose: () => closeDualView(),
    onDualInput: (side, value) => scheduleDual(side, value),
    onWallOpen: () => openWall(),
    onWallClose: () => closeWall(),
    onWallExport: () => exportWallImage(),
    onWallPick: (text) => {
      wallAfter = text;
      closeWall();
      ui.setValue(text);
      lastText = null;
      writeUrl(text); // 收起动画之后 URL 也要立刻是这一句（第 12 节：可复现）
    }
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
    // 单城视图不该留着上一个对比链接
    url.searchParams.delete('t1');
    url.searchParams.delete('t2');
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
        `规则 广场 ${cityPlan.plazas.length} · 断口 ${cityPlan.roadGaps.length} · 针 ${cityPlan.needles.length} · 扭塔 ${cityPlan.towers.length} · 围墙 ${cityPlan.walls.length} · 空地 ${
          (cityPlan.emptyLots || []).length
        } · 省略 ${omittedText}`
      );
      lines.push(`楼 ${cityPlan.units.length} · 简化形状 ${cityPlan.plotCount} · seed ${cityPlan.seed}`);
      lines.push(`drawcall ${city ? city.drawCalls + 2 : 0} / 12 · 实例上限 ${UNITS.instanceCap}`);
    } else {
      lines.push('还没有城。');
    }

    // 本轮视觉：把参数改动逐条列出来（before 是上一版的字面量，after 从 UNITS / PALETTE 现取）
    lines.push('');
    lines.push('视觉参数 diff（本轮）');
    VISUAL_DIFF.forEach((item) => {
      lines.push(`· ${item.label}  ${item.before} → ${item.after}`);
    });

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

  // ---------- 第 18 节 P1：双城对比 ----------

  function composeCity(text) {
    const tokens = tokenize(text);
    const features = extract(tokens, text);
    return { features, cityPlan: plan(features, fnv1a(text)) };
  }

  const signed = (score) => (score > 0 ? `+${score}` : String(score));

  // 差异表的每一个数字都直接取 CityPlan 字段，不在前端二次估算
  function buildDiffRows(a, b) {
    const tier = (cityPlan) =>
      `${SKY_LABEL[cityPlan.sky.key] || cityPlan.sky.key} ${signed(cityPlan.sky.sentimentScore)}`;
    const topToken = (cityPlan) => `${cityPlan.sky.topToken || '—'} ×${cityPlan.sky.topFrequency}`;
    return [
      { label: '词数', a: String(a.stats.tokens), b: String(b.stats.tokens) },
      { label: '半径', a: a.radius.toFixed(2), b: b.radius.toFixed(2) },
      { label: '平均词长', a: a.stats.avgTokenLen.toFixed(2), b: b.stats.avgTokenLen.toFixed(2) },
      { label: '情绪得分', a: signed(a.sky.sentimentScore), b: signed(b.sky.sentimentScore) },
      { label: '最高词', a: topToken(a), b: topToken(b) },
      { label: '建筑实例', a: String(a.stats.buildings), b: String(b.stats.buildings) },
      { label: '天色档位', a: tier(a), b: tier(b) }
    ];
  }

  function rebuildDual() {
    if (!dualText.a || !dualText.b) return;
    try {
      const left = composeCity(dualText.a);
      const right = composeCity(dualText.b);
      controller.applyDual(left.cityPlan, right.cityPlan);
      ui.setDualRows(buildDiffRows(left.cityPlan, right.cityPlan));
      if (wireframe) stage.setWireframe(true);
      writeUrlDual(dualText.a, dualText.b);
      ui.setStatus('');
    } catch (error) {
      console.error(error);
      ui.setStatus('error', `两座城有一边没建起来：${error && error.message ? error.message : error}`);
    }
  }

  function openDualView(aText, bText) {
    const fallbackB = EXAMPLES[2] ? EXAMPLES[2].text : SITE.defaultText;
    const a = String(aText || dualText.a || ui.getValue() || SITE.defaultText).trim();
    const b = String(bText || dualText.b || fallbackB).trim();
    view = 'dual';
    dualText = { a, b };
    ui.showDual(true);
    ui.setDualValues(a, b);
    ui.setStatus('');
    rebuildDual();
  }

  function closeDualView(silent) {
    if (view !== 'dual') return;
    view = 'single';
    ui.showDual(false);
    stage.exitDualView();
    controller.clear();
    lastText = null;
    if (!silent) {
      const text = ui.getValue().trim() || SITE.defaultText;
      generate(text);
    }
  }

  function scheduleDual(side, value) {
    const key = side === 'b' ? 'b' : 'a';
    window.clearTimeout(dualTimer[key]);
    dualTimer[key] = window.setTimeout(() => {
      const text = String(value || '').trim();
      if (!text || view !== 'dual' || text === dualText[key]) return;
      dualText[key] = text;
      rebuildDual();
    }, 300);
  }

  function writeUrlDual(a, b) {
    const url = new URL(window.location.href);
    url.searchParams.delete('t');
    url.searchParams.set('t1', a);
    url.searchParams.set('t2', b);
    window.history.replaceState(null, '', url.toString());
  }

  // ---------- 第 18 节 P4：城市墙 ----------

  let wallBusy = false;
  let wallCancelled = false;
  let wallAfter = null; // 从城里点某一格进来时，收尾后要重建的那句话
  let wallPrevious = 'single'; // 打开城市墙之前是哪个视图，收起时原路返回
  const nextFrame = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

  // 12 句逐城离屏渲染：全程只有一个 renderer、场景里最多一座城，
  // 每座城渲完立刻 clear()，几何/材质/贴图当帧释放，内存不会一路涨上去。
  async function openWall() {
    if (wallBusy || view === 'wall') return;
    const previous = view;
    wallPrevious = previous;
    wallBusy = true;
    wallCancelled = false;
    view = 'wall';
    ui.showWall(true);
    ui.clearWall();
    wallImages = [];
    stage.stop();
    ui.setWallProgress(`准备中 0 / ${WALL_SENTENCES.length}`);

    try {
      stage.beginOffscreen(UNITS.wallWidth, UNITS.wallHeight);
      for (let i = 0; i < WALL_SENTENCES.length; i += 1) {
        if (wallCancelled) break;
        const text = WALL_SENTENCES[i];
        ui.setWallProgress(`生成中 ${i + 1} / ${WALL_SENTENCES.length} · ${text.slice(0, 14)}`);
        await nextFrame();

        const built = composeCity(text);
        // instant：跳过升起动画；offscreen：跳过地块网格与浮尘，出图用不上
        controller.apply(built.cityPlan, { instant: true, offscreen: true });
        stage.setWallCamera(built.cityPlan.radius, built.cityPlan.landmark.height);
        stage.renderer.render(stage.scene, stage.camera);
        const dataUrl = stage.renderer.domElement.toDataURL('image/png');

        // 这一座城到此为止：立刻释放，再进下一句
        controller.clear();

        wallImages.push({ text, dataUrl });
        ui.addWallItem({
          dataUrl,
          text,
          width: UNITS.wallWidth,
          height: UNITS.wallHeight,
          skyKey: built.cityPlan.sky.key,
          skyLabel: SKY_LABEL[built.cityPlan.sky.key] || built.cityPlan.sky.key
        });
        await nextFrame();
      }
      if (!wallCancelled) {
        ui.setWallProgress(`${wallImages.length} / ${WALL_SENTENCES.length} · 完成`);
      }
    } catch (error) {
      console.error(error);
      ui.setStatus('error', `城市墙没画完：${error && error.message ? error.message : error}`);
    } finally {
      controller.clear();
      stage.endOffscreen();
      stage.start();
      wallBusy = false;
      ui.showWall(false);
      // 点某一格进来的话，先记下要重建哪句话
      const after = wallAfter;
      wallAfter = null;
      view = wallPrevious;
      // 点时的那句话优先；否则回到进来之前那个视图，别把用户丢在一张空地上
      if (after) {
        view = 'single';
        lastText = null;
        generate(after);
      } else if (view === 'dual') {
        rebuildDual();
      } else {
        view = 'single';
        lastText = null;
        generate(ui.getValue().trim() || SITE.defaultText);
      }
    }
  }

  function closeWall() {
    if (view !== 'wall') return;
    wallCancelled = true;
    ui.showWall(false);
    // 生成循环还活着的话交给 openWall 的 finally 收尾，别在这儿抢着重建
    if (!wallBusy) {
      const after = wallAfter;
      wallAfter = null;
      view = wallPrevious;
      if (after) {
        view = 'single';
        lastText = null;
        generate(after);
      } else if (view === 'dual') {
        rebuildDual();
      } else {
        view = 'single';
        lastText = null;
        generate(ui.getValue().trim() || SITE.defaultText);
      }
    }
  }

  // 导出：整墙长图一张（12 张逐一下载要 12 次弹窗，成本更高，所以选整墙）
  function exportWallImage() {
    if (!wallImages.length) {
      ui.setStatus('warn', '城市墙还没生成完。');
      return;
    }
    try {
      const cols = Math.max(1, UNITS.wallColumns);
      const cellW = UNITS.wallWidth;
      const cellH = UNITS.wallHeight;
      const gap = 16;
      const pad = 24;
      const caption = 46;
      const title = 64;
      const rows = Math.ceil(wallImages.length / cols);
      const width = pad * 2 + cols * cellW + (cols - 1) * gap;
      const height = pad * 2 + title + rows * (cellH + caption) + (rows - 1) * gap;

      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('当前浏览器不支持 2D 画布');

      ctx.fillStyle = '#0c0d11';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f6f3ea';
      ctx.font = '600 30px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${UI_COPY.title} · 城市墙`, pad, pad + 34);
      ctx.fillStyle = 'rgba(232,176,75,0.92)';
      ctx.font = '18px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
      ctx.fillText(`${wallImages.length} 句 · by ${SITE.author}`, pad, pad + 58);

      wallImages.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = pad + col * (cellW + gap);
        const y = pad + title + row * (cellH + caption + gap);
        const img = new Image();
        img.src = item.dataUrl;
        ctx.drawImage(img, x, y, cellW, cellH);
        ctx.fillStyle = 'rgba(246,243,234,0.92)';
        ctx.font = '20px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
        const sentence = item.text.length > 24 ? `${item.text.slice(0, 24)}…` : item.text;
        ctx.fillText(sentence, x + 4, y + cellH + 28);
      });

      const url = out.toDataURL('image/png');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `citywall-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      ui.setStatus('ok', '整墙长图已保存。');
    } catch (error) {
      console.error(error);
      ui.setStatus('error', `长图没存下来：${error && error.message ? error.message : error}`);
    }
  }

  if (firstDual) {
    ui.setValue(firstDual.a);
    openDualView(firstDual.a, firstDual.b);
  } else {
    ui.setValue(firstText);
    generate(firstText);
  }

  // 分享进来的链接如果带 ?t= 或 ?t1=&t2=，中文会被 URL 编码，这里只负责回填
  window.addEventListener('popstate', () => {
    const next = new URLSearchParams(window.location.search);
    const a = next.get('t1');
    const b = next.get('t2');
    if (a && b) {
      ui.setValue(a);
      openDualView(a, b);
      return;
    }
    const text = next.get('t') || SITE.defaultText;
    if (view === 'dual') closeDualView(true);
    ui.setValue(text);
    generate(text);
  });
}
