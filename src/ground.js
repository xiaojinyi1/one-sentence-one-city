// SECTION: ground
// 第 7 节 paint 段：地面。主干道、斑马线、广场、港区全部画进一张 canvas 贴图，
// 不额外增加 drawcall，也不加载任何外部图片。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';
import { createRng } from './seed.js';

export function createGround(cityPlan) {
  const radius = cityPlan.radius;
  const worldSize = radius * 2 * UNITS.groundScale;
  const size = UNITS.groundTextureSize;
  const scale = size / worldSize;
  const center = size / 2;
  const toX = (x) => center + x * scale;
  const toY = (z) => center + z * scale;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = createRng(cityPlan.seed ^ 0x1f3d5b);

  // 城外深，城内亮
  ctx.fillStyle = PALETTE.groundDeep;
  ctx.fillRect(0, 0, size, size);

  const disc = ctx.createRadialGradient(center, center, radius * scale * 0.15, center, center, radius * scale * 1.15);
  disc.addColorStop(0, '#1b1e26');
  disc.addColorStop(0.62, '#15171d');
  disc.addColorStop(1, PALETTE.groundDeep);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(center, center, radius * scale * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // 港区：城南深色沥青域，与住宅区之间靠一条横路分开
  const portTop = toY(cityPlan.avenue.portStart);
  ctx.fillStyle = '#101219';
  ctx.fillRect(toX(-radius * 0.95), portTop, radius * 1.9 * scale, (radius * 0.95) * scale);

  // 主干道（沿南北）
  const avenueWidth = cityPlan.avenue.half * 2;
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(toX(-cityPlan.avenue.half), toY(-radius), avenueWidth * scale, (radius + cityPlan.avenue.portStart) * scale);

  // 港区横向分隔路
  const portRoadZ = cityPlan.avenue.portStart - UNITS.plotGap * 2;
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(toX(-radius * 0.9), toY(portRoadZ), radius * 1.8 * scale, 0.9 * scale);

  // 句号断口 + 斑马线
  cityPlan.roadGaps.forEach((gap) => {
    const gapY = toY(gap.z);
    const gapH = gap.width * scale;
    ctx.fillStyle = '#191b22';
    ctx.fillRect(toX(-cityPlan.avenue.half), gapY - gapH / 2, avenueWidth * scale, gapH);

    const stripes = gap.stripes;
    const barH = gapH / (stripes * 2);
    ctx.fillStyle = 'rgba(238, 232, 214, 0.62)';
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillRect(toX(-cityPlan.avenue.half * 0.92), gapY - gapH / 2 + i * barH * 2 + barH * 0.5, avenueWidth * 0.92 * scale, barH);
    }
  });

  // 广场石面
  cityPlan.plazas.forEach((plaza) => {
    ctx.fillStyle = PALETTE.plazaStone;
    ctx.beginPath();
    ctx.arc(toX(plaza.x), toY(plaza.z), plaza.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 225, 195, 0.16)';
    ctx.lineWidth = Math.max(1, 0.05 * scale);
    ctx.beginPath();
    ctx.arc(toX(plaza.x), toY(plaza.z), plaza.radius * 0.84 * scale, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 街道肌理：细噪点，避免大面积纯色
  const dots = 5200;
  for (let i = 0; i < dots; i += 1) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const alpha = rng.range(0.015, 0.06);
    ctx.fillStyle = rng.chance(0.5)
      ? `rgba(255, 236, 205, ${alpha})`
      : `rgba(0, 0, 0, ${alpha * 1.6})`;
    const r = rng.range(0.4, 1.6);
    ctx.fillRect(x, y, r, r);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(worldSize, worldSize);
  geometry.rotateX(-Math.PI / 2);

  const tint = new THREE.Color(PALETTE.sky[cityPlan.sky.key].ground || '#101218');
  tint.lerp(new THREE.Color('#ffffff'), 0.62);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: tint,
    roughness: 0.96,
    metalness: 0.02
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.02;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

export function disposeGround(mesh) {
  if (!mesh) return;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
  }
}
