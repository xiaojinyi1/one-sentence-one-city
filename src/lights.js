// SECTION: lights
// 第 7 节 paint 段：基础灯光。天色决定日光颜色，地标另有自己的点光（在 build 里）。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

export function createLights(cityPlan, options) {
  const opts = options || {};
  const palette = PALETTE.sky[cityPlan.sky.key];
  const radius = cityPlan.radius;
  const group = new THREE.Group();
  group.name = 'lights';

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(palette.ambient),
    new THREE.Color(palette.ground),
    UNITS.ambientIntensity * 3.2
  );
  group.add(hemi);

  const ambient = new THREE.AmbientLight(new THREE.Color(palette.ambient), UNITS.ambientIntensity);
  group.add(ambient);

  const sun = new THREE.DirectionalLight(new THREE.Color(palette.sun), UNITS.lightIntensity);
  sun.position.set(radius * 0.85, radius * 1.5, radius * 0.7);
  sun.castShadow = true;

  const shadowSpan = radius * 1.4;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = radius * 7;
  sun.shadow.bias = UNITS.shadowBias;
  sun.shadow.normalBias = 0.02;
  const mapSize = opts.isMobile ? UNITS.shadowMobile : UNITS.shadowDesktop;
  sun.shadow.mapSize.set(mapSize, mapSize);
  // 改过阴影相机的边界之后必须重算投影矩阵，否则仍用默认的 10×10 视野
  sun.shadow.camera.updateProjectionMatrix();
  group.add(sun);
  group.add(sun.target);

  // 背光：给楼体一点天色反射，避免背阴面死黑
  const rim = new THREE.DirectionalLight(new THREE.Color(palette.bottom), 0.4);
  rim.position.set(-radius * 0.9, radius * 0.55, -radius * 0.8);
  group.add(rim);

  return { group, sun, hemi, ambient, rim };
}
