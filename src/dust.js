// SECTION: dust
// 第 10 节 氛围：浮尘粒子不超过 200，随 seed 固定分布（同一句话飘同样的尘）。
// prefers-reduced-motion 时整层不建，主视觉用返回 null 表达「关了」。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';
import { createRng } from './seed.js';

export function createDust(cityPlan, options) {
  const opts = options || {};
  if (opts.enabled === false) return null;

  const count = Math.min(UNITS.dustMax, 200);
  const rng = createRng((cityPlan.seed ^ 0x9e3779b9) >>> 0);
  const radius = cityPlan.radius * UNITS.dustSpread;
  const spread = Math.max(1, cityPlan.radius * UNITS.dustHeight);

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = rng.unit() * Math.PI * 2;
    const distance = Math.sqrt(rng.unit()) * radius;
    positions[i * 3] = Math.cos(angle) * distance;
    positions[i * 3 + 1] = 0.3 + rng.unit() * spread * 0.55;
    positions[i * 3 + 2] = Math.sin(angle) * distance;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(PALETTE.sky[cityPlan.sky.key].sun || '#ffe6b8'),
    size: UNITS.dustSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: UNITS.dustOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'dust';
  points.frustumCulled = false;
  points.renderOrder = 3;
  return points;
}

export function disposeDust(points) {
  if (!points) return;
  if (points.geometry) points.geometry.dispose();
  if (points.material) points.material.dispose();
}
