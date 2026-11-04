// SECTION: scene
// 第 7 节 paint 段：渲染器、相机、控制器、天色/地面/灯光的装配。
// 这一层不生成城市，只负责「把东西放上去、把相机摆好」。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE, UNITS } from './constants.js';
import { createGround, disposeGround } from './ground.js';
import { createSky, disposeSky } from './sky.js';
import { createLights } from './lights.js';
import { createDust, disposeDust } from './dust.js';
import { createDebugOverlay, disposeDebugOverlay } from './debugview.js';

export function createStage(canvas, options) {
  const opts = options || {};
  const isMobile = opts.isMobile === true;
  const reducedMotion = opts.reducedMotion === true;
  const lowEnd = opts.lowEnd === true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    // 第 12 节头号坑：不开这个，canvas.toDataURL 导出的是全黑图
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  // 第 11 节：低端设备关掉真实阴影，只留烘焙在贴图里的接触阴影
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 第 11/15 节：像素比上限 —— 桌面 2、移动 1.5、低端设备一律 1.5
  const maxPixelRatio = lowEnd ? 1.5 : isMobile ? UNITS.maxPixelRatioMobile : UNITS.maxPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    UNITS.cameraFov,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.1,
    600
  );

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minPolarAngle = UNITS.minPolarAngle;
  controls.maxPolarAngle = UNITS.maxPolarAngle;
  controls.autoRotateSpeed = UNITS.autoRotateSpeed;

  const state = {
    ground: null,
    sky: null,
    lights: null,
    dust: null,
    debug: null,
    radius: UNITS.radiusMin
  };

  let lastInteraction = performance.now();
  const frameHooks = [];
  let debugView = false;

  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    lastInteraction = performance.now();
  });

  // 竖屏（手机）视锥很窄：整座城装不下，索性只退一点点，
  // 让地标吃满画面、两侧楼群自然出画（比缩成一个小点好看）
  function frameCamera(radius) {
    const aspect = camera.aspect || 1;
    const stretch = aspect < 1 ? 1.15 : 1;
    const dist = radius * UNITS.cameraDist * stretch;
    camera.position.set(dist * 0.06, radius * UNITS.cameraHeight * (stretch > 1 ? 1.1 : 1), dist);
    controls.target.set(0, radius * 0.1 * UNITS.cameraTarget, 0);
    controls.minDistance = radius * 0.5;
    controls.maxDistance = radius * 3.4 * stretch;
    controls.update();
  }

  function setRadius(radius) {
    state.radius = radius;
    frameCamera(radius);
  }

  function applyLook(cityPlan) {
    if (state.sky) {
      scene.remove(state.sky);
      disposeSky(state.sky);
    }
    if (state.ground) {
      scene.remove(state.ground);
      disposeGround(state.ground);
    }
    if (state.lights) scene.remove(state.lights.group);
    if (state.dust) {
      scene.remove(state.dust);
      disposeDust(state.dust);
    }
    if (state.debug) {
      scene.remove(state.debug);
      disposeDebugOverlay(state.debug);
    }

    const palette = PALETTE.sky[cityPlan.sky.key];
    state.sky = createSky(cityPlan, cityPlan.radius);
    state.ground = createGround(cityPlan);
    state.lights = createLights(cityPlan, { isMobile, lowEnd });
    // 第 15 节：reduced-motion 时浮尘关闭
    state.dust = createDust(cityPlan, { enabled: !reducedMotion });
    state.debug = createDebugOverlay(cityPlan);
    state.debug.visible = debugView;

    scene.add(state.sky, state.ground, state.lights.group);
    if (state.dust) scene.add(state.dust);
    scene.add(state.debug);

    // 环境贴图也从天空球现做（第 2 节：不加载任何外部 HDR）：
    // 没有 envMap 的金属在 three 里会直接发黑，雨夜的湿反射也无处可反射。
    if (state.envTarget) {
      state.envTarget.dispose();
      state.envTarget = null;
    }
    const envScene = new THREE.Scene();
    const skyClone = state.sky.clone();
    skyClone.frustumCulled = false;
    envScene.add(skyClone);
    const pmrem = new THREE.PMREMGenerator(renderer);
    state.envTarget = pmrem.fromScene(envScene, 0.04, 0.1, cityPlan.radius * UNITS.skyRadiusScale * 1.2);
    scene.environment = state.envTarget.texture;
    pmrem.dispose();

    // 雾色与天空的地平线以下同色（见 sky.js），远处地面自然化进天色
    const fogColor = new THREE.Color(palette.fog);
    scene.fog = new THREE.Fog(
      fogColor,
      cityPlan.radius * UNITS.fogNearScale,
      cityPlan.radius * UNITS.fogFarScale
    );
    scene.background = null;
    scene.userData.key = cityPlan.sky.key;
  }

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(width, height, false);
    // 竖屏 / 横屏切换后重新构图，否则手机上城市会被裁掉
    if (state.radius) frameCamera(state.radius);
  }

  // 调试用：只把建筑物切成线框，地面 / 天空 / 地标光柱保持原样
  const WIREFRAME_SKIP = new Set(['ground', 'sky', 'beam', 'dust', 'debug']);

  function setWireframe(enabled) {
    scene.traverse((object) => {
      if (!object.isMesh && !object.isInstancedMesh) return;
      if (WIREFRAME_SKIP.has(object.name)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        if ('wireframe' in material) material.wireframe = enabled;
      });
    });
  }

  // F 键的调试底图：地块网格 / 分区色块 / 文字标注。开着时关掉浮尘，守住 drawcall 预算。
  function setDebugView(enabled) {
    debugView = enabled === true;
    if (state.debug) state.debug.visible = debugView;
    if (state.dust) state.dust.visible = !debugView;
  }

  function onFrame(hook) {
    if (typeof hook === 'function') frameHooks.push(hook);
  }

  function renderOnce() {
    controls.update();
    renderer.render(scene, camera);
  }

  let running = false;
  let frameHandle = 0;

  function frame() {
    if (!running) return;
    frameHandle = requestAnimationFrame(frame);

    const now = performance.now();
    if (!reducedMotion && !controls.autoRotate && !document.hidden && now - lastInteraction > UNITS.autoRotateDelay) {
      controls.autoRotate = true;
    }
    if (reducedMotion) controls.autoRotate = false;

    for (let i = 0; i < frameHooks.length; i += 1) frameHooks[i](now);
    controls.update();
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    lastInteraction = performance.now();
    frame();
  }

  function stop() {
    running = false;
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  window.addEventListener('resize', resize);

  // 第 11 节：标签页隐藏时暂停渲染循环，回来再续上
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  resize();
  setRadius(UNITS.radiusMin);

  return {
    renderer,
    scene,
    camera,
    controls,
    state,
    reducedMotion,
    setRadius,
    applyLook,
    resize,
    setWireframe,
    setDebugView,
    onFrame,
    renderOnce,
    start,
    stop
  };
}
