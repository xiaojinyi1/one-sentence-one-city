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
      <button class="link" type="button" data-action="about">这座城是怎么长出来的</button>
    </div>
    <div class="bottom-right">
      <span class="privacy">${UI_COPY.privacy}</span>
      <span class="author">by ${SITE.author}</span>
    </div>
  </footer>

  <p class="keys">${UI_COPY.keyHints}</p>

  <aside class="debug" hidden aria-label="调试读数"></aside>
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
  about.querySelector('p').textContent = UI_COPY.aboutBody.replace(/\\n/g, '\n');

  const chips = [];
  EXAMPLES.forEach((example) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.innerHTML = '<span class="chip-label"></span><span class="chip-text"></span>';
    chip.querySelector('.chip-label').textContent = example.label;
    chip.querySelector('.chip-text').textContent = example.text;
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
    if (name === 'about') about.hidden = !about.hidden;
    if (name === 'about-close') about.hidden = true;
  });

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
      if (h.onWireframe) h.onWireframe();
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

  function setDebug(text) {
    debug.textContent = text;
  }

  function setBusy(busy) {
    form.classList.toggle('is-busy', Boolean(busy));
  }

  return {
    canvas,
    input,
    setStatus,
    setDebug,
    setBusy,
    debugEl: debug,
    getValue: () => input.value,
    setValue: (value) => {
      input.value = value;
    },
    focus: () => input.focus()
  };
}
