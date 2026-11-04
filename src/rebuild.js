// SECTION: rebuild
// 第 8 节：任何一次输入都走同一条链 —— 先清掉旧城，再按新 plan 重新 build。
// 第 10 节：建筑按距地标远近错峰升起，单栋 0.5~0.7s，间隔 8~20ms。

import * as THREE from 'three';
import { UNITS } from './constants.js';
import { buildCity, createCityKit, disposeCity } from './build.js';
import { createRng } from './seed.js';

const matrix = new THREE.Matrix4();
const EASE = (t) => 1 - Math.pow(1 - t, 3);

export function createCityController(stage) {
  const kit = createCityKit();
  let current = null;
  let planRef = null;
  let rise = null;

  function clear() {
    if (!current) return;
    stage.scene.remove(current.group);
    disposeCity(current.group);
    current = null;
    planRef = null;
    rise = null;
  }

  // 把每个实例的基准矩阵抄一份，并算出自己的错峰延迟（按距地标远近排序）
  function prepareRise(cityPlan) {
    if (stage.reducedMotion) {
      rise = null;
      return;
    }

    const rng = createRng((cityPlan.seed ^ 0x5bd1e995) >>> 0);
    const entries = [];

    current.group.traverse((object) => {
      if (!object.isInstancedMesh || !object.userData.rise) return;
      for (let i = 0; i < object.count; i += 1) {
        object.getMatrixAt(i, matrix);
        const x = matrix.elements[12];
        const z = matrix.elements[14];
        entries.push({ mesh: object, index: i, distance: Math.sqrt(x * x + z * z) });
      }
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

  function apply(cityPlan) {
    clear();
    stage.applyLook(cityPlan);
    current = buildCity(cityPlan, kit);
    stage.scene.add(current.group);
    stage.setRadius(cityPlan.radius);
    planRef = cityPlan;
    prepareRise(cityPlan);
    return current;
  }

  return {
    kit,
    apply,
    clear,
    get city() {
      return current;
    },
    get plan() {
      return planRef;
    }
  };
}
