// SECTION: materials
// 第 7.3 节：窗光用 instanceColor + 自定义 emissive 属性（aGlow）。
// 立面纹理由 canvas 现场画出来，不加载任何外部图片。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

const TILE = 64;

export function createFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');

  // 一格的立面：墙是浅灰、窗接近纯白 —— 亮度差被 shader 当作窗光遮罩。
  // 墙不能太暗：这张图还要乘上 instanceColor 的墙色，暗了整栋楼会发黑。
  ctx.fillStyle = 'rgb(215,215,215)';
  ctx.fillRect(0, 0, TILE, TILE);

  ctx.fillStyle = 'rgb(170,170,170)';
  ctx.fillRect(0, 0, TILE, 3);
  ctx.fillRect(0, TILE - 4, TILE, 4);

  ctx.fillStyle = 'rgb(255,252,246)';
  ctx.fillRect(18, 15, 28, 34);

  ctx.fillStyle = 'rgb(196,192,184)';
  ctx.fillRect(31, 15, 2, 34);
  ctx.fillRect(18, 31, 28, 2);

  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(16, 49, 32, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const GLOW_CHUNK = /* glsl */ `
  attribute float aGlow;
  varying float vGlow;
  varying float vRoof;
`;

const GLOW_VERTEX = /* glsl */ `
  vGlow = aGlow;
  vRoof = step(0.5, normal.y);
`;

const GLOW_FRAGMENT = /* glsl */ `
  varying float vGlow;
  varying float vRoof;
`;

function attachGlow(material, hasMap) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLOW_CHUNK}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GLOW_VERTEX}`);

    if (hasMap) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aUvScale;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv *= aUvScale;');
    }

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLOW_FRAGMENT}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;`
      );

    if (hasMap) {
      // 窗光遮罩取自「贴图原色」，不能取已经乘过 instanceColor 的 diffuseColor：
      // 否则墙色越深，窗户越不容易过阈值，整栋楼的窗光会被墙色拖没。
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float rawLuma = dot(texture2D(map, vMapUv).rgb, vec3(0.299, 0.587, 0.114));
        float winMask = smoothstep(0.72, 0.92, rawLuma) * (1.0 - vRoof);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, vRoof);
        totalEmissiveRadiance *= winMask;`
      );
    }
  };
  material.customProgramCacheKey = () => (hasMap ? 'facade-glow' : 'plain-glow');
  return material;
}

export function createFacadeMaterial(options) {
  const opts = options || {};
  const material = new THREE.MeshStandardMaterial({
    map: opts.texture || createFacadeTexture(),
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color(opts.window || '#ffd9a0'),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1.15 : opts.emissiveIntensity,
    roughness: opts.roughness === undefined ? 0.7 : opts.roughness,
    metalness: opts.metalness === undefined ? 0.08 : opts.metalness
  });
  return attachGlow(material, true);
}

export function createPlainMaterial(options) {
  const opts = options || {};
  const material = new THREE.MeshStandardMaterial({
    color: opts.color === undefined ? 0xffffff : opts.color,
    vertexColors: true,
    emissive: new THREE.Color(opts.emissive || '#000000'),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
    roughness: opts.roughness === undefined ? 0.6 : opts.roughness,
    metalness: opts.metalness === undefined ? 0.2 : opts.metalness,
    flatShading: opts.flatShading === true
  });
  return attachGlow(material, false);
}

// instanceColor 要经 vColor 生效，几何体必须带一份白色的顶点色
export function whiteVertexColors(geometry) {
  const count = geometry.getAttribute('position').count;
  const colors = new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3);
  geometry.setAttribute('color', colors);
  return geometry;
}

// 给 5 组 InstancedMesh 用的公共实例属性：aGlow（窗光亮度）、aUvScale（楼层/开窗倍数）
export function ensureInstanceAttributes(geometry, count) {
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  glow.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aGlow', glow);

  if (!geometry.getAttribute('aUvScale')) {
    const uv = new THREE.InstancedBufferAttribute(new Float32Array(count * 2).fill(1), 2);
    uv.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aUvScale', uv);
  }
  return geometry;
}

// SECTION: sky
// 三套天色落到材质层：雨夜把商业立面往霓虹色推、并把窗光调亮；
// 清晨压暗窗光，黄昏居中。只调共享材质的参数，不新建材质（第 7.3 节）。
const SKY_MOOD = {
  dusk: { window: 1.05, neon: UNITS.neonDusk, beam: 0.26 },
  night: { window: 1.55, neon: UNITS.neonNight, beam: 0.4 },
  morning: { window: 0.5, neon: UNITS.neonMorning, beam: 0.16 }
};

export function applySkyMood(kit, skyKey) {
  const mood = SKY_MOOD[skyKey] || SKY_MOOD.dusk;

  kit.residential.emissive.set(PALETTE.residential.window);
  kit.residential.emissiveIntensity = mood.window;

  const cold = new THREE.Color(PALETTE.commercial.window);
  const neon = new THREE.Color(PALETTE.commercial.neon);
  kit.commercial.emissive.copy(cold).lerp(neon, skyKey === 'night' ? 0.62 : skyKey === 'dusk' ? 0.34 : 0.1);
  kit.commercial.emissiveIntensity = mood.window * 0.95;

  kit.beam.opacity = mood.beam;
  return mood;
}