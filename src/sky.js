// SECTION: sky
// 第 4 节 R6 / 第 10 节：天色由情绪决定。
// 用一颗顶点着色的球做渐变，不写自定义 shader、不用贴图，色彩空间交给 three 处理。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

export function createSky(cityPlan, radius) {
  const palette = PALETTE.sky[cityPlan.sky.key];
  const geometry = new THREE.SphereGeometry(radius * UNITS.skyRadiusScale, 48, 24);

  const top = new THREE.Color(palette.top);
  const bottom = new THREE.Color(palette.bottom);
  const sun = new THREE.Color(palette.sun);
  const fog = new THREE.Color(palette.fog);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).normalize();
    const h = Math.min(1, Math.max(0, vertex.y * 0.5 + 0.5));
    color.copy(bottom).lerp(top, Math.pow(h, 0.9));

    // 地平线附近一点暖意
    const horizon = 1 - Math.min(1, Math.abs(vertex.y) / 0.34);
    if (horizon > 0) color.lerp(sun, horizon * 0.12);

    // 地平线两侧都往雾色靠：远处地面被雾吃成雾色，接不上就是一道硬线
    const seam = 1 - Math.min(1, Math.abs(vertex.y) / 0.18);
    if (seam > 0) color.lerp(fog, seam * 0.75);

    // 地平线以下一律收到雾色：地面边缘与天空在远处同色，看不出接缝
    if (vertex.y < 0) color.lerp(fog, Math.min(1, -vertex.y / 0.1));

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export function disposeSky(mesh) {
  if (!mesh) return;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) mesh.material.dispose();
}
