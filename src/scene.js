// SECTION: scene
// 第 7 节 paint 段：渲染器、相机、控制器、天色/地面/灯光的装配。
// 这一层不生成城市，只负责「把东西放上去、把相机摆好」。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE, UNITS } from './constants.js';
import { createGround, disposeGround } from './ground.js';
import { createSky, disposeSky } from './sky.js';
import { createLights, disposeLights } from './lights.js';
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
  // 本轮视觉：用 PCF（而不是 PCFSoft）才能让 light.shadow.radius 真的生效，
  // 三个天色各自给一个核半径 —— 晨光要更糊、对比更低。
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // 静态城市场景：阴影只在城市/灯光/升起动画变化时刷新。
  // 相机旋转、缩放和阻尼不会改变阴影，避免每帧重复提交深度 pass。
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
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
    radius: UNITS.radiusMin,
    // 第 18 节 P1：dual 为真时相机停在「两城同框」的机位，
    // span 是两城的共同半宽（决定雾、天空球、投影视锥的大小）
    dual: false,
    span: UNITS.radiusMin
  };

  let lastInteraction = performance.now();
  const frameHooks = [];
  let debugView = false;
  // 调试层懒创建：保存最近一次可创建调试层的 plan，
  // 只有第一次按 F 时才真正生成 1024² CanvasTexture。
  let debugPlan = null;
  let debugAvailable = false;

  // PMREM 环境贴图有界 LRU 缓存。
  // 天空颜色只由天色档决定，球半径与 PMREM far 同比例缩放，
  // 因此同一组 sky key 可以安全复用同一份环境贴图。
  const envCache = new Map();
  const envCacheLimit = isMobile || lowEnd ? UNITS.envCacheMobile : UNITS.envCacheDesktop;

  function disposeEnvTarget(target) {
    if (!target) return;
    if (target.texture) target.texture.dispose();
    target.dispose();
  }

  function getEnvTarget(cityPlan, look, span) {
    const dual = Boolean(look.secondary);
    const key = dual
      ? `v1|${cityPlan.sky.key}|${look.secondary.sky.key}`
      : `v1|${cityPlan.sky.key}`;

    const cached = envCache.get(key);
    if (cached) {
      envCache.delete(key);
      envCache.set(key, cached);
      return cached;
    }

    const envScene = new THREE.Scene();
    const skyClone = state.sky.clone();
    skyClone.frustumCulled = false;
    envScene.add(skyClone);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(envScene, 0.04, 0.1, span * UNITS.skyRadiusScale * 1.2);
    pmrem.dispose();

    envCache.set(key, target);
    while (envCache.size > envCacheLimit) {
      const oldestKey = envCache.keys().next().value;
      if (oldestKey === key) break;
      const oldest = envCache.get(oldestKey);
      envCache.delete(oldestKey);
      disposeEnvTarget(oldest);
    }
    return target;
  }

  function invalidateShadows() {
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
  }

  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    lastInteraction = performance.now();
  });

  // 竖屏（手机）视锥很窄：整座城装不下，索性只退一点点，
  // 让地标吃满画面、两侧楼群自然出画（比缩成一个小点好看）
  function frameCamera(radius, landmarkHeight) {
    const aspect = camera.aspect || 1;
    const stretch = aspect < 1 ? 1.15 : 1;
    // 本轮视觉：地标最高能到几十个单位，光按半径构图会把塔顶切掉，
    // 所以取「按半径」和「按地标高度」里更远的那一档。
    const dist =
      Math.max(radius * UNITS.cameraDist, (landmarkHeight || 0) * UNITS.cameraFit) * stretch;
    camera.position.set(dist * 0.06, radius * UNITS.cameraHeight * (stretch > 1 ? 1.1 : 1), dist);
    controls.target.set(0, radius * 0.1 * UNITS.cameraTarget, 0);
    controls.minDistance = radius * 0.5;
    controls.maxDistance = Math.max(dist * 1.6, radius * 3.4 * stretch);
    controls.update();
  }

  function setRadius(radius, landmarkHeight = 0, keepCamera = false) {
    state.radius = radius;
    state.landmarkHeight = landmarkHeight;
    if (keepCamera) return;
    state.dual = false;
    frameCamera(radius, landmarkHeight);
  }

  // 第 18 节 P1：两个城并排时，把相机沿 Z 后撤，让 span（两城半宽）落进水平视锥。
  // FOV 不动，退出时恢复原来的机位与极角，漫游状态不丢。
  let savedView = null;

  function frameDual(span) {
    const aspect = camera.aspect || 1;
    const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const byWidth = (span * UNITS.dualCameraMargin) / Math.tan(hHalf);
    const byHeight = (span * 1.1) / Math.tan(vHalf);
    const dist = Math.max(byWidth, byHeight);
    camera.position.set(0, span * UNITS.dualCameraHeight, dist);
    controls.target.set(0, span * 0.08, 0);
    controls.minDistance = dist * 0.45;
    controls.maxDistance = dist * 1.9;
    controls.update();
  }

  function enterDualView(span) {
    if (!state.dual) {
      savedView = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance
      };
    }
    state.dual = true;
    state.span = span;
    frameDual(span);
  }

  function exitDualView() {
    state.dual = false;
    if (!savedView) return;
    camera.position.copy(savedView.position);
    controls.target.copy(savedView.target);
    controls.minDistance = savedView.minDistance;
    controls.maxDistance = savedView.maxDistance;
    controls.update();
    savedView = null;
  }

  // 把当前这套「天色 + 地面 + 光照 + 浮尘 + 调试贴图 + 环境贴图」整个放掉。
  // 城市墙要 12 座城首尾相接，必须每座城渲完就调它，否则 canvas 贴图会一路涨。
  function releaseLook() {
    if (state.sky) {
      scene.remove(state.sky);
      disposeSky(state.sky);
      state.sky = null;
    }
    if (state.ground) {
      scene.remove(state.ground);
      disposeGround(state.ground);
      state.ground = null;
    }
    if (state.lights) {
      scene.remove(state.lights.group);
      // DirectionalLight 的 shadow map 不会随 remove 自动回收
      disposeLights(state.lights);
      state.lights = null;
    }
    if (state.dust) {
      scene.remove(state.dust);
      disposeDust(state.dust);
      state.dust = null;
    }
    if (state.debug) {
      scene.remove(state.debug);
      disposeDebugOverlay(state.debug);
      state.debug = null;
    }
    debugPlan = null;
    debugAvailable = false;
    if (state.envTarget) {
      // PMREM target 由有界缓存持有；这里只解绑当前引用，不直接释放
      state.envTarget = null;
      scene.environment = null;
    }
  }

  function applyLook(cityPlan, options) {
    const look = options || {};
    // 单城视图：span 就是半径、没有第二座城 —— 走的是和以前完全一样的那条路
    const span = look.span || cityPlan.radius;
    const dual = Boolean(look.secondary);
    const groundPlan = look.groundPlan || cityPlan;

    releaseLook();

    const palette = PALETTE.sky[cityPlan.sky.key];
    state.sky = createSky(cityPlan, span, look.secondary || null);
    state.ground = createGround(groundPlan);
    state.lights = createLights(cityPlan, {
      isMobile,
      lowEnd,
      span: dual ? span : 0,
      secondaryPalette: dual ? look.secondary.sky.key : null
    });
    // 第 15 节：reduced-motion 时浮尘关闭；双城视图省掉浮尘（守 drawcall 预算）
    state.dust =
      look.skipDust === true ? null : createDust(cityPlan, { enabled: !reducedMotion });
    // 双城时那块「地块网格 + 分区标注」不属于任何一座城，直接不做；
    // 城市墙离屏出图也跳过它。调试层改为懒创建：
    // 只有 F 开着或之后第一次按 F 时才真正生成 1024² 贴图。
    state.debug = null;
    if (!dual && look.skipDebug !== true) {
      debugPlan = cityPlan;
      debugAvailable = true;
      if (debugView) {
        state.debug = createDebugOverlay(cityPlan);
        state.debug.visible = true;
      }
    }

    scene.add(state.sky, state.ground, state.lights.group);
    if (state.dust) scene.add(state.dust);
    if (state.debug) scene.add(state.debug);

    // 环境贴图仍从程序化天空球生成（不加载任何外部 HDR），
    // 但按天色 key 进入有界 LRU 缓存，城市墙 12 张图不再逐张重做 PMREM。
    state.envTarget = getEnvTarget(cityPlan, look, span);
    scene.environment = state.envTarget.texture;

    // 雾色与天空的地平线以下同色（见 sky.js），远处地面自然化进天色
    const fogColor = new THREE.Color(palette.fog);
    // 双城时相机退得更远，雾也得跟着往外推，否则两座城一起糊成一片
    const fogNear = dual ? span * UNITS.dualFogNear : span * UNITS.fogNearScale;
    const fogFar = dual ? span * UNITS.dualFogFar : span * UNITS.fogFarScale;
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
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
    // 竖屏 / 横屏切换后重新构图，否则手机上城市会被裁掉；双城视图重算同框机位
    if (state.dual) frameDual(state.span);
    else if (state.radius) frameCamera(state.radius, state.landmarkHeight);
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
    if (debugView && !state.debug && debugAvailable && debugPlan) {
      state.debug = createDebugOverlay(debugPlan);
      state.debug.visible = true;
      scene.add(state.debug);
    } else if (state.debug) {
      state.debug.visible = debugView;
    }
    if (state.dust) state.dust.visible = !debugView;
  }

  function onFrame(hook) {
    if (typeof hook === 'function') frameHooks.push(hook);
  }

  function renderOnce() {
    // 导出前强制刷新一次阴影，确保当前帧与实例矩阵完全一致
    invalidateShadows();
    controls.update();
    renderer.render(scene, camera);
  }

  // 第 18 节 P4：城市墙复用同一个 renderer 逐城离屏渲染。
  // 只改渲染目标的像素尺寸与机位，不新建 renderer / canvas，也不动 canvas 的 CSS 尺寸。
  let offscreen = null;

  function beginOffscreen(width, height) {
    if (!offscreen) {
      offscreen = {
        pixelRatio: renderer.getPixelRatio(),
        aspect: camera.aspect,
        position: camera.position.clone(),
        target: controls.target.clone(),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        dual: state.dual,
        span: state.span
      };
    }
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // 固定俯视机位：极角 0.42π，按城市半径（与地标高度）取距离，FOV 不变
  function setWallCamera(radius, landmarkHeight) {
    const aspect = camera.aspect || 1;
    const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const byWidth = (radius * UNITS.wallCameraMargin) / Math.tan(hHalf);
    const byHeight = Math.max(radius * 0.6, (landmarkHeight || 0) * 0.7) / Math.tan(vHalf);
    const dist = Math.max(byWidth, byHeight);
    const polar = UNITS.wallPolar;
    camera.position.set(0, Math.cos(polar) * dist, Math.sin(polar) * dist);
    controls.target.set(0, radius * 0.05, 0);
    controls.update();
  }

  function endOffscreen() {
    if (!offscreen) return;
    renderer.setPixelRatio(offscreen.pixelRatio);
    camera.aspect = offscreen.aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, Math.max(1, window.innerHeight), false);
    controls.minDistance = offscreen.minDistance;
    controls.maxDistance = offscreen.maxDistance;
    camera.position.copy(offscreen.position);
    controls.target.copy(offscreen.target);
    controls.update();
    state.dual = offscreen.dual;
    state.span = offscreen.span;
    offscreen = null;
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
    enterDualView,
    exitDualView,
    applyLook,
    releaseLook,
    beginOffscreen,
    endOffscreen,
    setWallCamera,
    resize,
    setWireframe,
    setDebugView,
    invalidateShadows,
    onFrame,
    renderOnce,
    start,
    stop
  };
}
