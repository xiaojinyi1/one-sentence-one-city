// SECTION: debug-view
// 第 13 节：F 键线框视图配合的调试底图 —— 地块网格 + 功能分区色块 + 文字标注。
// 整张图是一块贴了 canvas 的平面，只占 1 个 drawcall，且只在调试模式可见。

import * as THREE from 'three';
import { UNITS } from './constants.js';

const SIZE = 1024;

export function createDebugOverlay(cityPlan) {
  const radius = cityPlan.radius;
  const worldSize = radius * 2 * UNITS.groundScale;
  const scale = SIZE / worldSize;
  const center = SIZE / 2;
  const toX = (x) => center + x * scale;
  const toY = (z) => center + z * scale;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  const portStart = cityPlan.avenue.portStart;
  const avenueHalf = cityPlan.avenue.half;

  // 功能分区色块（颜色只作辅助，真正的信息在文字标注里）
  ctx.fillStyle = 'rgba(255, 196, 132, 0.16)';
  ctx.fillRect(toX(-radius), toY(-radius), radius * scale, portStart * 2 * scale);

  ctx.fillStyle = 'rgba(140, 190, 255, 0.16)';
  ctx.fillRect(toX(0), toY(-radius), radius * scale, portStart * 2 * scale);

  ctx.fillStyle = 'rgba(190, 140, 255, 0.18)';
  ctx.fillRect(toX(-radius), toY(portStart), radius * 2 * scale, (radius - portStart) * scale);

  // 地块网格
  const step = cityPlan.shape.plotSize + UNITS.plotGap;
  ctx.strokeStyle = 'rgba(246, 243, 234, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -radius; x <= radius; x += step) {
    ctx.moveTo(toX(x), toY(-radius));
    ctx.lineTo(toX(x), toY(radius));
  }
  for (let z = -radius; z <= radius; z += step) {
    ctx.moveTo(toX(-radius), toY(z));
    ctx.lineTo(toX(radius), toY(z));
  }
  ctx.stroke();

  // 主干道边界 + 港区分界
  ctx.strokeStyle = 'rgba(232, 176, 75, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toX(-avenueHalf), toY(-radius));
  ctx.lineTo(toX(-avenueHalf), toY(portStart));
  ctx.moveTo(toX(avenueHalf), toY(-radius));
  ctx.lineTo(toX(avenueHalf), toY(portStart));
  ctx.moveTo(toX(-radius), toY(portStart));
  ctx.lineTo(toX(radius), toY(portStart));
  ctx.stroke();

  // 地标位置
  ctx.strokeStyle = 'rgba(232, 176, 75, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), Math.max(6, cityPlan.landmark.footprint * scale * 1.4), 0, Math.PI * 2);
  ctx.stroke();

  // 文字标注（不做「只靠颜色」的信息载体）
  const label = (text, x, z, color) => {
    ctx.font = `600 ${Math.round(SIZE / 72)}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, toX(x), toY(z));
  };

  label('住宅区 · 前半句', -radius * 0.55, -radius * 0.62, 'rgba(255, 214, 170, 0.92)');
  label('商业区 · 后半句', radius * 0.55, -radius * 0.62, 'rgba(180, 215, 255, 0.92)');
  label('港区 · 数字与网址', 0, radius * 0.82, 'rgba(214, 190, 255, 0.92)');
  label('地标 · 末位 token', 0, radius * 0.14, 'rgba(232, 176, 75, 0.95)');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(worldSize, worldSize);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    toneMapped: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = UNITS.debugPlaneLift;
  mesh.name = 'debug';
  mesh.renderOrder = 2;
  mesh.visible = false;
  return mesh;
}

export function disposeDebugOverlay(mesh) {
  if (!mesh) return;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
  }
}
