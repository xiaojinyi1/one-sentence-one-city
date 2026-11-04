// SECTION: lights
// 第 7 节 paint 段：基础灯光。天色决定日光颜色，地标另有自己的点光（在 build 里）。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

export function createLights(cityPlan, options) {
  const opts = options || {};
  const palette = PALETTE.sky[cityPlan.sky.key];
  const radius = cityPlan.radius;
  // 第 18 节 P1：双城时用 span（两城的共同半宽）决定投影视锥与灯位，
  // 这样投影只有一盏、开销不变，两座城都落在同一张阴影贴图里。
  const span = opts.span || radius;
  const group = new THREE.Group();
  group.name = 'lights';

  // 本轮视觉：三档的天光/环境光/阴影软硬都由天色配置给出（不再各写一份数字）
  const ambientLevel = palette.ambientLevel ?? UNITS.ambientIntensity;
  const hemiLevel = palette.hemiLevel ?? ambientLevel * 3.2;
  const sunIntensity = UNITS.lightIntensity * (palette.sunScale ?? 1);
  const shadowRadius = palette.shadowRadius ?? 3;

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(palette.ambient),
    new THREE.Color(palette.ground),
    hemiLevel
  );
  group.add(hemi);

  const ambient = new THREE.AmbientLight(new THREE.Color(palette.ambient), ambientLevel);
  group.add(ambient);

  const sun = new THREE.DirectionalLight(new THREE.Color(palette.sun), sunIntensity);
  sun.position.set(span * 0.85, span * 1.5, span * 0.7);
  sun.castShadow = !opts.lowEnd;

  // 视锥收紧到城区（第 10 节）：只包住半径外扩一点点，阴影分辨率才够用
  const shadowSpan = span * UNITS.shadowSpanScale;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = span * 7;
  sun.shadow.bias = UNITS.shadowBias;
  sun.shadow.normalBias = 0.02;
  // 本轮视觉：晨光把阴影调得更糊、对比更低（PCF 用 radius 做核半径）
  sun.shadow.radius = shadowRadius;
  const mapSize = opts.isMobile ? UNITS.shadowMobile : UNITS.shadowDesktop;
  sun.shadow.mapSize.set(mapSize, mapSize);
  // 改过阴影相机的边界之后必须重算投影矩阵，否则仍用默认的 10×10 视野
  sun.shadow.camera.updateProjectionMatrix();
  group.add(sun);
  group.add(sun.target);

  // 背光：给楼体一点天色反射，避免背阴面死黑
  const rim = new THREE.DirectionalLight(new THREE.Color(palette.bottom), 0.4);
  rim.position.set(-span * 0.9, span * 0.55, -span * 0.8);
  group.add(rim);

  // 第 18 节 P1：双城时右城有自己的天色档，用一盏不投影的补光把它的色温带过来。
  // 投影光始终只有上面那一盏，阴影开销不随城数增加。
  if (opts.secondaryPalette) {
    const other = PALETTE.sky[opts.secondaryPalette];
    const fill = new THREE.DirectionalLight(
      new THREE.Color(other.sun),
      UNITS.dualFillIntensity ?? 0.38
    );
    fill.position.set(span * 0.75, span * 0.9, -span * 0.6);
    fill.castShadow = false;
    group.add(fill);
  }

  return { group, sun, hemi, ambient, rim };
}
