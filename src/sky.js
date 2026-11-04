// SECTION: sky
// 第 4 节 R6 / 第 10 节：天色由情绪决定。
// 用一颗顶点着色的球做渐变，不写自定义 shader、不用贴图，色彩空间交给 three 处理。
//
// 第 18 节 P1：双城对比时右半边的天空来自右侧那座城的天色档，
// 左右各是同一颗球的一半，中间用一条过渡带接起来 —— 所以整屏能看到两种天色，
// 而天空中只有一颗网格、一份材质。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

// 把某一档天色在某高度上应该是什么颜色，写进 out
function skyColor(palette, y, out) {
  const top = new THREE.Color(palette.top);
  const mid = new THREE.Color(palette.mid || palette.bottom);
  const bottom = new THREE.Color(palette.bottom);
  const sun = new THREE.Color(palette.sun);
  const fog = new THREE.Color(palette.fog);
  const haze = new THREE.Color(palette.haze || palette.fog);

  if (y >= 0) {
    // 地平线 → 中段 → 顶部：越低越暖，越高越冷。
    // 用开方而不是线性，让暖色只留在地平线附近一圈，上方很快冷下去 ——
    // 否则相机看到的整条天际线都是同一个暖色，画面就平了。
    if (y < 0.5) out.copy(bottom).lerp(mid, Math.sqrt(y / 0.5));
    else out.copy(mid).lerp(top, Math.pow((y - 0.5) / 0.5, 0.75));
  } else {
    // 地平线以下天空不再显形，交给雾色
    out.copy(fog);
  }

  // 地平线附近一点暖意
  const horizon = 1 - Math.min(1, Math.abs(y) / 0.34);
  if (horizon > 0) out.lerp(sun, horizon * 0.1);

  // 本轮视觉：地平线上一条薄雾线，把天和地缝在一起
  const band = 1 - Math.min(1, Math.abs(y) / 0.05);
  if (band > 0) out.lerp(haze, band * 0.45);

  // 地平线以下一律收到雾色：地面边缘与天空在远处同色，看不出接缝
  if (y < 0) out.lerp(fog, Math.min(1, -y / 0.12));

  return out;
}

export function createSky(cityPlan, radius, secondaryPlan) {
  const paletteA = PALETTE.sky[cityPlan.sky.key];
  const paletteB = secondaryPlan ? PALETTE.sky[secondaryPlan.sky.key] : null;
  const geometry = new THREE.SphereGeometry(radius * UNITS.skyRadiusScale, 48, 24);

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();
  const color = new THREE.Color();
  const left = new THREE.Color();
  const right = new THREE.Color();
  const seam = UNITS.dualSeam;

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).normalize();
    const y = Math.min(1, Math.max(-1, vertex.y));

    skyColor(paletteA, y, left);
    if (paletteB) {
      skyColor(paletteB, y, right);
      // 视线方向偏左取左城天色、偏右取右城天色，中间一段平滑过渡
      const t = THREE.MathUtils.smoothstep(vertex.x, -seam, seam);
      color.copy(left).lerp(right, t);
    } else {
      color.copy(left);
    }

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
