// SECTION: ui
// 第 14 节文案逐字上屏；第 15 节调试面板；第 16 节键盘与可访问性。

import { EXAMPLES, MAX_TEXT, SITE, UI_COPY } from './constants.js';

const SHELL = `
  <div class="stage-wrap">
    <canvas id="scene" class="scene" aria-label="由句子生成的城市，可拖动旋转、滚轮缩放"></canvas>
  </div>

  <header class="hud hud-top">
    <h1 class="title">${UI_COPY.title}</h1>
    <p class="subtitle">${UI_COPY.subtitle}</p>
  </header>

  <form class="composer" autocomplete="off">
    <input class="input" type="text" name="sentence" maxlength="${MAX_TEXT}"
      placeholder="${UI_COPY.placeholder}" aria-label="一句话" spellcheck="false">
    <button class="go" type="submit" aria-label="生成城市">→</button>
  </form>

  <div class="examples" role="group" aria-label="示例句子"></div>

  <p class="status" role="status" aria-live="polite"></p>

  <footer class="hud hud-bottom">
    <div class="bottom-left">
      <button class="link" type="button" data-action="share">分享这座城</button>
      <button class="link" type="button" data-action="export" aria-label="下载这座城的图片">保存图片</button>
      <button class="link" type="button" data-action="dual">双城对比</button>
      <button class="link" type="button" data-action="wall">城市墙</button>
      <button class="link" type="button" data-action="about">这座城是怎么长出来的</button>
    </div>
    <div class="bottom-right">
      <span class="privacy">${UI_COPY.privacy}</span>
      <span class="author">by ${SITE.author}</span>
    </div>
  </footer>

  <section class="dual" hidden aria-label="双城对比">
    <div class="dual-head">
      <span class="dual-title">双城对比 · 两句话并排</span>
      <button class="link" type="button" data-action="dual-close">回到一座城</button>
    </div>
    <div class="dual-inputs">
      <label class="dual-field">
        <span class="dual-tag">左</span>
        <input class="input dual-input" data-side="a" type="text" maxlength="${MAX_TEXT}"
          placeholder="${UI_COPY.placeholder}" aria-label="左边那句话" spellcheck="false">
      </label>
      <label class="dual-field">
        <span class="dual-tag">右</span>
        <input class="input dual-input" data-side="b" type="text" maxlength="${MAX_TEXT}"
          placeholder="${UI_COPY.placeholder}" aria-label="右边那句话" spellcheck="false">
      </label>
    </div>
    <div class="dual-diff-wrap">
      <table class="dual-diff">
        <thead>
          <tr><th scope="col">特征</th><th scope="col">左</th><th scope="col">右</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="wall" hidden aria-label="城市墙">
    <div class="wall-head">
      <span class="wall-title">城市墙 · 十二句话</span>
      <span class="wall-progress" role="status" aria-live="polite"></span>
      <span class="wall-actions">
        <button class="link" type="button" data-action="wall-export">导出整墙长图</button>
        <button class="link" type="button" data-action="wall-close">收起</button>
      </span>
    </div>
    <div class="wall-grid"></div>
  </section>

  <p class="keys">${UI_COPY.keyHints}</p>

  <aside class="debug" hidden aria-label="调试读数">
    <div class="debug-head">
      <span class="debug-title">读数 · D</span>
      <button class="link debug-export" type="button" data-action="plan-json" aria-label="导出 CityPlan JSON">CityPlan JSON</button>
    </div>
    <pre class="debug-body"></pre>
  </aside>
  <section class="about" hidden aria-label="${UI_COPY.aboutTitle}">
    <h2>${UI_COPY.aboutTitle}</h2>
    <p></p>
    <button class="link" type="button" data-action="about-close">收起来</button>
  </section>
`;

export function createUI(app, handlers) {
  const h = handlers || {};
  app.innerHTML = SHELL;

  const canvas = app.querySelector('#scene');
  const form = app.querySelector('.composer');
  const input = app.querySelector('.input');
  const status = app.querySelector('.status');
  const examplesBox = app.querySelector('.examples');
  const debug = app.querySelector('.debug');
  const about = app.querySelector('.about');
  // 第 18 节 P1 / P4：新增的两个视图
  const dual = app.querySelector('.dual');
  const dualInputs = app.querySelectorAll('.dual-input');
  const dualInputA = app.querySelector('.dual-input[data-side="a"]');
  const dualInputB = app.querySelector('.dual-input[data-side="b"]');
  const dualBody = app.querySelector('.dual-diff tbody');
  const wall = app.querySelector('.wall');
  const wallGrid = app.querySelector('.wall-grid');
  const wallProgress = app.querySelector('.wall-progress');
  about.querySelector('p').textContent = UI_COPY.aboutBody.replace(/\\n/g, '\n');

  const chips = [];
  EXAMPLES.forEach((example) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    // 第 16 节：动态值一律用 createElement + textContent，不拼 HTML 字符串
    const chipLabel = document.createElement('span');
    chipLabel.className = 'chip-label';
    chipLabel.textContent = example.label;
    const chipText = document.createElement('span');
    chipText.className = 'chip-text';
    chipText.textContent = example.text;
    chip.appendChild(chipLabel);
    chip.appendChild(chipText);
    chip.addEventListener('click', () => {
      input.value = example.text;
      if (h.onExample) h.onExample(example.text);
    });
    examplesBox.appendChild(chip);
    chips.push(chip);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (h.onSubmit) h.onSubmit(input.value);
  });

  app.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.getAttribute('data-action');
    if (name === 'share' && h.onShare) h.onShare();
    if (name === 'export' && h.onExport) h.onExport();
    if (name === 'plan-json' && h.onPlanJson) h.onPlanJson();
    if (name === 'dual' && h.onDualOpen) h.onDualOpen();
    if (name === 'dual-close' && h.onDualClose) h.onDualClose();
    if (name === 'wall' && h.onWallOpen) h.onWallOpen();
    if (name === 'wall-close' && h.onWallClose) h.onWallClose();
    if (name === 'wall-export' && h.onWallExport) h.onWallExport();
    if (name === 'about') about.hidden = !about.hidden;
    if (name === 'about-close') about.hidden = true;
  });

  // 第 18 节 P1：两个输入框各自实时重建（debounce 在 main 里做，这里只报值）
  dualInputs.forEach((field) => {
    field.addEventListener('input', (event) => {
      if (event.isComposing) return;
      if (h.onDualInput) h.onDualInput(field.dataset.side, field.value);
    });
    field.addEventListener('compositionend', () => {
      if (h.onDualInput) h.onDualInput(field.dataset.side, field.value);
    });
  });

  // 第 9 节：移动端键盘弹起不得遮挡城市主体 —— 用量出来的键盘高度把输入条顶上去
  if (window.visualViewport) {
    const viewport = window.visualViewport;
    const fit = () => {
      const gap = Math.max(0, window.innerHeight - viewport.height);
      app.style.setProperty('--kb', `${Math.round(gap)}px`);
    };
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    fit();
  }

  window.addEventListener('keydown', (event) => {
    const typing = event.target === input;
    if (event.key === '/' && !typing) {
      event.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (typing) return;
    if (event.key === 'r' || event.key === 'R') {
      const next = chips[Math.floor(Math.random() * chips.length)];
      if (next) next.click();
    }
    if (event.key === 'f' || event.key === 'F') {
      // 第 13 节：F 同时切线框与「地块/分区」叠加层，两个视图一起看
      if (h.onWireframe) h.onWireframe();
      if (h.onDebugView) h.onDebugView();
    }
    if (event.key === 'd' || event.key === 'D') {
      debug.hidden = !debug.hidden;
      if (!debug.hidden && h.onDebug) h.onDebug();
    }
    if (event.key === 'Escape') about.hidden = true;
  });

  function setStatus(kind, text) {
    status.textContent = text || '';
    status.dataset.kind = kind || '';
  }

  const debugBody = debug.querySelector('.debug-body');

  function setDebug(text) {
    if (!debugBody) return;
    debugBody.textContent = text || '';
    if (!debug.hidden) debugBody.scrollTop = 0;
  }

  function setBusy(busy) {
    form.classList.toggle('is-busy', Boolean(busy));
  }

  // 第 18 节 P1：进入对比视图时主输入条让位，两个输入框接管
  function showDual(enabled) {
    dual.hidden = !enabled;
    document.body.classList.toggle('is-dual', enabled);
    if (enabled && dualInputA) dualInputA.focus();
  }

  function setDualValues(a, b) {
    if (dualInputA && a !== undefined) dualInputA.value = a;
    if (dualInputB && b !== undefined) dualInputB.value = b;
  }

  // 差异表：数字都在 main 里从各自 CityPlan 取，这里只负责摆到屏幕上
  function setDualRows(rows) {
    if (!dualBody) return;
    dualBody.textContent = '';
    (rows || []).forEach((row) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row.label;
      tr.appendChild(th);
      const left = document.createElement('td');
      left.textContent = row.a;
      tr.appendChild(left);
      const right = document.createElement('td');
      right.textContent = row.b;
      tr.appendChild(right);
      dualBody.appendChild(tr);
    });
  }

  // 第 18 节 P4：城市墙
  function showWall(enabled) {
    wall.hidden = !enabled;
    document.body.classList.toggle('is-wall', enabled);
  }

  function clearWall() {
    wallGrid.textContent = '';
  }

  function setWallProgress(text) {
    wallProgress.textContent = text || '';
  }

  function addWallItem(item) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'wall-cell';
    cell.setAttribute('aria-label', `用「${item.text}」重建城市`);

    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = `「${item.text}」生成的城市`;
    img.decoding = 'async';
    img.width = item.width;
    img.height = item.height;

    const caption = document.createElement('span');
    caption.className = 'wall-sentence';
    caption.textContent = item.text;

    const dot = document.createElement('span');
    dot.className = 'wall-dot';
    dot.dataset.sky = item.skyKey;
    dot.title = item.skyLabel;

    cell.appendChild(img);
    cell.appendChild(caption);
    cell.appendChild(dot);
    cell.addEventListener('click', () => {
      if (h.onWallPick) h.onWallPick(item.text);
    });
    wallGrid.appendChild(cell);
    return cell;
  }

  return {
    canvas,
    input,
    dualInputA,
    dualInputB,
    wallGrid,
    setStatus,
    setDebug,
    setBusy,
    debugEl: debug,
    showDual,
    setDualValues,
    setDualRows,
    showWall,
    clearWall,
    setWallProgress,
    addWallItem,
    getValue: () => input.value,
    setValue: (value) => {
      input.value = value;
    },
    focus: () => input.focus()
  };
}
