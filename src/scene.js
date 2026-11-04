// SECTION: scene
// 第 7 节 paint 段：渲染器、相机、控制器、天色/地面/灯光的装配。
// 这一层不生成城市，只负责「把东西放上去、把相机摆好」。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE, UNITS } from './constants.js';
import { createGround, disposeGround } from './ground.js';
import { createSky, disposeSky } from './sky.js';
import { createLights } from './lights.js';

export function createStage(canvas, options) {
  const opts = options || {};
  const isMobile = opts.isMobile === true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? UNITS.maxPixelRatioMobile : UNITS.maxPixelRatio));

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
    radius: UNITS.radiusMin
  };

  let lastInteraction = performance.now();

  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    lastInteraction = performance.now();
  });

  function setRadius(radius) {
    state.radius = radius;
    camera.position.set(radius * 0.06, radius * UNITS.cameraHeight, radius * UNITS.cameraDist);
    controls.target.set(0, radius * 0.1 * UNITS.cameraTarget, 0);
    controls.minDistance = radius * 0.5;
    controls.maxDistance = radius * 3.4;
    controls.update();
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

    const palette = PALETTE.sky[cityPlan.sky.key];
    state.sky = createSky(cityPlan, cityPlan.radius);
    state.ground = createGround(cityPlan);
    state.lights = createLights(cityPlan, { isMobile });

    scene.add(state.sky, state.ground, state.lights.group);
    scene.fog = new THREE.Fog(
      new THREE.Color(palette.fog),
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? UNITS.maxPixelRatioMobile : UNITS.maxPixelRatio));
    renderer.setSize(width, height, false);
  }

  // 调试用：只把建筑物切成线框，地面 / 天空 / 地标光柱保持原样
  const WIREFRAME_SKIP = new Set(['ground', 'sky', 'beam']);

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

  let running = false;
  let frameHandle = 0;

  function frame() {
    if (!running) return;
    frameHandle = requestAnimationFrame(frame);

    const now = performance.now();
    if (!controls.autoRotate && !document.hidden && now - lastInteraction > UNITS.autoRotateDelay) {
      controls.autoRotate = true;
    }

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
  resize();
  setRadius(UNITS.radiusMin);

  return {
    renderer,
    scene,
    camera,
    controls,
    state,
    setRadius,
    applyLook,
    resize,
    setWireframe,
    start,
    stop
  };
}
