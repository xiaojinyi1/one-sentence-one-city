// SECTION: rebuild
// 第 8 节：任何一次输入都走同一条链 —— 先清掉旧城，再按新 plan 重新 build。
// 第 10 节：建筑按距地标远近错峰升起，单栋 0.5~0.7s，间隔 8~20ms。

import * as THREE from 'three';
import { UNITS } from './constants.js';
import { buildCity, createCityKit, disposeCity } from './build.js';
import { createRng } from './seed.js';

const matrix = new THREE.Matrix4();
const EASE = (t) => 1 - Math.pow(1 - t, 3);

// 第 18 节 P1：把两座城的「地面要素」按各自偏移并成一张 union plan，
// 这样中间那条地平线是一整块地面（一次 drawcall），而不是两块叠在一起打架。
function unionGroundPlan(planA, planB, offsetA, offsetB, span) {
  const shiftPoint = (position, dx) => [position[0] + dx, position[1], position[2]];
  const shiftUnit = (unit, dx) => ({ ...unit, position: shiftPoint(unit.position, dx) });
  const shiftWharf = (wharf, dx) => ({ ...wharf, position: shiftPoint(wharf.position, dx) });

  return {
    seed: planA.seed,
    radius: span,
    shape: planA.shape,
    sky: planA.sky,
    stats: planA.stats,
    spines: [
      {
        x: -offsetA,
        radius: planA.radius,
        half: planA.avenue.half,
        portStart: planA.avenue.portStart,
        port: planA.wharves.length > 0,
        gaps: planA.roadGaps
      },
      {
        x: offsetB,
        radius: planB.radius,
        half: planB.avenue.half,
        portStart: planB.avenue.portStart,
        port: planB.wharves.length > 0,
        gaps: planB.roadGaps
      }
    ],
    plazas: [
      ...planA.plazas.map((plaza) => ({ ...plaza, x: plaza.x - offsetA })),
      ...planB.plazas.map((plaza) => ({ ...plaza, x: plaza.x + offsetB }))
    ],
    roadGaps: [
      ...planA.roadGaps.map((gap) => ({ ...gap, x: -offsetA })),
      ...planB.roadGaps.map((gap) => ({ ...gap, x: offsetB }))
    ],
    wharves: [
      ...planA.wharves.map((wharf) => shiftWharf(wharf, -offsetA)),
      ...planB.wharves.map((wharf) => shiftWharf(wharf, offsetB))
    ],
    units: [
      ...planA.units.map((unit) => shiftUnit(unit, -offsetA)),
      ...planB.units.map((unit) => shiftUnit(unit, offsetB))
    ],
    emptyLots: [
      ...(planA.emptyLots || []).map((lot) => ({
        ...lot,
        position: shiftPoint(lot.position, -offsetA)
      })),
      ...(planB.emptyLots || []).map((lot) => ({
        ...lot,
        position: shiftPoint(lot.position, offsetB)
      }))
    ],
    landmark: {
      ...planA.landmark,
      position: shiftPoint(planA.landmark.position, -offsetA)
    }
  };
}

export function createCityController(stage) {
  const kit = createCityKit();
  let kitB = null;
  let current = null;
  let currentB = null;
  let planRef = null;
  let planRefB = null;
  let rise = null;

  function clearOne(city) {
    if (!city) return;
    stage.scene.remove(city.group);
    disposeCity(city.group);
  }

  function clear() {
    if (!current && !currentB) {
      if (stage.releaseLook) stage.releaseLook();
      return;
    }
    clearOne(current);
    clearOne(currentB);
    current = null;
    currentB = null;
    planRef = null;
    planRefB = null;
    rise = null;
    // 天色 / 地面 / 光照 / 环境贴图也一起放掉：城市墙每渲完一座就调这里，
    // canvas 贴图与 PMREM 不会跨城市累积（第 18 节 P4 的内存要求）。
    if (stage.releaseLook) stage.releaseLook();
  }

  // 把每个实例的基准矩阵抄一份，并算出自己的错峰延迟（按距地标远近排序）。
  // 双城时两座城的 group 一起排，谁的楼离自己的地标近谁先长出来。
  function prepareRise(groups, cityPlan) {
    if (stage.reducedMotion) {
      rise = null;
      return;
    }

    const rng = createRng((cityPlan.seed ^ 0x5bd1e995) >>> 0);
    const entries = [];

    groups.forEach((group) => {
      group.traverse((object) => {
        if (!object.isInstancedMesh || !object.userData.rise) return;
        for (let i = 0; i < object.count; i += 1) {
          object.getMatrixAt(i, matrix);
          // 实例矩阵是相对自己那个 group 的局部坐标，
          // 所以这里算的就是「离本城地标多远」，两城互不干扰。
          const x = matrix.elements[12];
          const z = matrix.elements[14];
          entries.push({ mesh: object, index: i, distance: Math.sqrt(x * x + z * z) });
        }
      });
    });

    entries.sort((a, b) => a.distance - b.distance || a.index - b.index);

    const meshes = new Map();
    entries.forEach((entry, order) => {
      let bucket = meshes.get(entry.mesh);
      if (!bucket) {
        bucket = {
          mesh: entry.mesh,
          base: new Float32Array(entry.mesh.count * 16),
          delay: new Float32Array(entry.mesh.count),
          duration: new Float32Array(entry.mesh.count),
          pending: new Uint8Array(entry.mesh.count).fill(1)
        };
        meshes.set(entry.mesh, bucket);
      }
      const offset = order * (UNITS.riseStaggerMin + rng.unit() * (UNITS.riseStaggerMax - UNITS.riseStaggerMin));
      bucket.delay[entry.index] = offset;
      bucket.duration[entry.index] = UNITS.riseMin + rng.unit() * (UNITS.riseMax - UNITS.riseMin);
    });

    // 基准矩阵最后统一抄，避免中途覆盖
    meshes.forEach((bucket) => {
      for (let i = 0; i < bucket.mesh.count; i += 1) {
        bucket.mesh.getMatrixAt(i, matrix);
        bucket.base.set(matrix.elements, i * 16);
      }
    });

    rise = { meshes: [...meshes.values()], startedAt: performance.now() };
  }

  function tick(now) {
    if (!rise) return;
    const elapsed = (now - rise.startedAt) / 1000;
    let alive = false;

    rise.meshes.forEach((bucket) => {
      const { mesh, base, delay, duration, pending } = bucket;
      const elements = mesh.instanceMatrix.array;
      let dirty = false;
      for (let i = 0; i < mesh.count; i += 1) {
        if (pending[i] === 0) continue;
        const raw = duration[i] > 0 ? (elapsed - delay[i]) / duration[i] : 1;
        const offset = i * 16;
        // 每帧先回到基准矩阵，收尾那一帧自然落在 100%，不会卡在 98% 的高度
        for (let e = 0; e < 16; e += 1) elements[offset + e] = base[offset + e];
        dirty = true;
        if (raw >= 1) {
          pending[i] = 0;
          continue;
        }
        alive = true;
        const progress = EASE(raw < 0 ? 0 : raw);
        // 沿 Y 方向从地面长出来：缩放 y 与 y 位移等比收缩，底边始终贴地
        elements[offset + 5] *= progress;
        elements[offset + 13] *= progress;
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    });

    if (!alive) rise = null;
  }

  stage.onFrame(tick);

  function apply(cityPlan, options) {
    const opts = options || {};
    clear();
    // 城市墙是离屏出图：地块网格与浮尘都看不见，别为它们多花一次贴图和一次 drawcall
    stage.applyLook(cityPlan, opts.offscreen ? { skipDebug: true, skipDust: true } : undefined);
    current = buildCity(cityPlan, kit);
    stage.scene.add(current.group);
    stage.setRadius(cityPlan.radius, cityPlan.landmark.height);
    planRef = cityPlan;
    // 城市墙要的是一张静止的画面，不需要升起动画
    if (!opts.instant) prepareRise([current.group], cityPlan);
    return current;
  }

  // 第 18 节 P1：两句话左右各一城。
  // 同一个 scene、两个 Group、共用一套相机/灯光/天空/渲染管线 —— 不建第二个 canvas。
  // buildCity 会按天色改写材质上的 emissive，所以两座城各用一套 kit（两套材质）。
  function applyDual(planA, planB) {
    clear();
    if (!kitB) kitB = createCityKit();

    const gap = Math.max(
      UNITS.dualGapMin,
      Math.max(planA.radius, planB.radius) * UNITS.dualGapRatio
    );
    const offsetA = planA.radius + gap / 2;
    const offsetB = planB.radius + gap / 2;
    const span = Math.max(offsetA + planA.radius, offsetB + planB.radius);

    const groundPlan = unionGroundPlan(planA, planB, offsetA, offsetB, span);

    stage.applyLook(planA, {
      secondary: planB,
      span,
      groundPlan,
      skipDust: UNITS.dualSkipDust === true
    });

    current = buildCity(planA, kit);
    current.group.position.x = -offsetA;
    currentB = buildCity(planB, kitB);
    currentB.group.position.x = offsetB;
    stage.scene.add(current.group, currentB.group);

    // 两城各有自己的地标与光柱（buildCity 各建各的 PointLight），这里不做任何合并
    stage.setRadius(span, 0, true);
    stage.enterDualView(span);
    planRef = planA;
    planRefB = planB;
    prepareRise([current.group, currentB.group], planA);
    return { a: current, b: currentB };
  }

  return {
    kit,
    apply,
    applyDual,
    clear,
    get city() {
      return current;
    },
    get cityB() {
      return currentB;
    },
    get plan() {
      return planRef;
    },
    get planB() {
      return planRefB;
    }
  };
}
