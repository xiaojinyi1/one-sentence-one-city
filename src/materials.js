// SECTION: materials
// 第 7.3 节：窗光用 instanceColor + 自定义 emissive 属性（aGlow）。
// 立面纹理由 canvas 现场画出来，不加载任何外部图片。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';

const TILE = UNITS.facadeTextureSize;

export function createFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  const s = TILE / 64;

  // 一格的立面：墙是浅灰、窗接近纯白 —— 亮度差被 shader 当作窗光遮罩。
  // 墙不能太暗：这张图还要乘上 instanceColor 的墙色，暗了整栋楼会发黑。
  ctx.fillStyle = 'rgb(215,215,215)';
  ctx.fillRect(0, 0, TILE, TILE);

  // 轻微墙面粉化：只做极低对比的竖向纹理，避免照片化污渍
  for (let x = 0; x < TILE; x += 3) {
    const alpha = 0.015 + ((x * 37) % 11) * 0.002;
    ctx.fillStyle = (x / 3) % 2 === 0 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.7})`;
    ctx.fillRect(x, 0, 1, TILE);
  }

  // 楼板线和勒脚
  ctx.fillStyle = 'rgb(170,170,170)';
  ctx.fillRect(0, 0, TILE, Math.max(3, 3 * s));
  ctx.fillRect(0, TILE - Math.max(4, 4 * s), TILE, Math.max(4, 4 * s));

  // 窗框：略低于墙，不参与窗光遮罩
  ctx.fillStyle = 'rgb(188,184,176)';
  ctx.fillRect(18 * s, 15 * s, 28 * s, 34 * s);

  // 窗玻璃：必须保持接近纯白，窗光阈值依赖这段亮度
  ctx.fillStyle = 'rgb(255,252,246)';
  ctx.fillRect((18 + 1.4) * s, (15 + 1.4) * s, (28 - 2.8) * s, (34 - 2.8) * s);

  // 竖梃和横梃
  ctx.fillStyle = 'rgb(196,192,184)';
  ctx.fillRect(31 * s, 15 * s, Math.max(1, 1.2 * s), 34 * s);
  ctx.fillRect(18 * s, 31 * s, 28 * s, Math.max(1, 1.2 * s));

  // 窗台
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(16 * s, 49 * s, 32 * s, Math.max(1, 1.6 * s));

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createContainerTexture() {
  const size = UNITS.containerTextureSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 中性近白底色：箱体颜色仍由 instanceColor 提供，避免被底色乘暗
  ctx.fillStyle = 'rgb(236,236,236)';
  ctx.fillRect(0, 0, size, size);

  // 竖向瓦楞：低对比明暗条，配合 bumpMap 形成轻微起伏
  const rib = Math.max(4, Math.round(size / 16));
  for (let x = 0; x < size; x += rib) {
    ctx.fillStyle = 'rgba(0,0,0,0.075)';
    ctx.fillRect(x, 0, Math.max(1, rib * 0.22), size);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + Math.max(1, rib * 0.62), 0, Math.max(1, rib * 0.2), size);
  }

  // 边角框架
  const edge = Math.max(3, Math.round(size * 0.045));
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, size, edge);
  ctx.fillRect(0, size - edge, size, edge);
  ctx.fillRect(0, 0, edge, size);
  ctx.fillRect(size - edge, 0, edge, size);

  // 端面门缝与锁杆：只做轻微软阴影，不增加几何
  const doorX = size * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(doorX - Math.max(1, size * 0.006), edge, Math.max(2, size * 0.012), size - edge * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(size * 0.32, edge, Math.max(1, size * 0.008), size - edge * 2);
  ctx.fillRect(size * 0.68, edge, Math.max(1, size * 0.008), size - edge * 2);

  // 顶面浅波纹与边角磨损
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fillRect(0, size * 0.18, size, Math.max(1, size * 0.02));
  ctx.fillRect(0, size * 0.8, size, Math.max(1, size * 0.02));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const GLOW_CHUNK = /* glsl */ `
  attribute float aGlow;
  attribute float aSeed;
  attribute float aTwist;
  varying float vGlow;
  varying float vRoof;
  varying float vFaceSeed;
`;

const GLOW_VERTEX = /* glsl */ `
  vGlow = aGlow;
  vRoof = step(0.5, normal.y);
  vFaceSeed = aSeed + abs(normal.x) * 17.17 + abs(normal.z) * 31.37;
`;

const GLOW_FRAGMENT = /* glsl */ `
  varying float vGlow;
  varying float vRoof;
  varying float vFaceSeed;
  // 本轮视觉：窗格亮灯率（每扇窗按「层×列 + 实例/朝向种子」决定亮不亮）
  uniform float uLitRate;
`;

function attachGlow(material, hasMap, options) {
  const opts = options || {};
  material.onBeforeCompile = (shader) => {
    let vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${GLOW_CHUNK}`
    );

    if (opts.twist === true) {
      vertexShader = vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          float twistNormalAngle = (position.y + 0.5) * aTwist;
          float twistNormalCos = cos(twistNormalAngle);
          float twistNormalSin = sin(twistNormalAngle);
          objectNormal.xz = mat2(twistNormalCos, -twistNormalSin, twistNormalSin, twistNormalCos) * objectNormal.xz;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          ${GLOW_VERTEX}
          float twistPositionAngle = (position.y + 0.5) * aTwist;
          float twistPositionCos = cos(twistPositionAngle);
          float twistPositionSin = sin(twistPositionAngle);
          transformed.xz = mat2(twistPositionCos, -twistPositionSin, twistPositionSin, twistPositionCos) * transformed.xz;`
        );
    } else {
      vertexShader = vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${GLOW_VERTEX}`
      );
    }

    shader.vertexShader = vertexShader;

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
      // 亮灯率走 uniform：切天色时只改这个值，不重建材质（第 7.3 节）
      shader.uniforms.uLitRate = material.userData.litRate;
      // 窗光遮罩取自「贴图原色」，不能取已经乘过 instanceColor 的 diffuseColor：
      // 否则墙色越深，窗户越不容易过阈值，整栋楼的窗光会被墙色拖没。
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float rawLuma = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float winMask = smoothstep(0.72, 0.92, rawLuma) * (1.0 - vRoof);
        // 本轮视觉：vMapUv 的整数部分是「层×列」，再叠加实例与朝向种子，
        // 同尺寸楼也不会得到完全相同的亮灯图案
        vec2 winCell = floor(vMapUv);
        float winRand = fract(sin(dot(vec3(winCell, vFaceSeed), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float winLit = step(winRand, uLitRate);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, vRoof);
        // 没点亮的窗是暗玻璃，点亮的窗才留给 emissive
        diffuseColor.rgb *= mix(1.0, 0.45, winMask * (1.0 - winLit));
        totalEmissiveRadiance *= winMask * winLit;`
      );
    }
  };
  material.customProgramCacheKey = () => {
    if (!hasMap) return 'plain-glow-v2';
    return opts.twist === true ? 'facade-glow-twist-v2' : 'facade-glow-v2';
  };
  return material;
}

export function createTwistDepthMaterial() {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTwist;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float depthTwistAngle = (position.y + 0.5) * aTwist;
        float depthTwistCos = cos(depthTwistAngle);
        float depthTwistSin = sin(depthTwistAngle);
        transformed.xz = mat2(depthTwistCos, -depthTwistSin, depthTwistSin, depthTwistCos) * transformed.xz;`
      );
  };
  material.customProgramCacheKey = () => 'twist-depth-v1';
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
  // 本轮视觉：默认按黄昏档的亮灯率起步，applySkyMood 会按天色改它
  material.userData.litRate = { value: UNITS.windowLitDusk };
  return attachGlow(material, true, { twist: opts.twist === true });
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
    flatShading: opts.flatShading === true,
    map: opts.map || null,
    bumpMap: opts.bumpMap || null,
    bumpScale: opts.bumpScale === undefined ? 1 : opts.bumpScale
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

// 给全部实例组用的公共实例属性：
// aGlow（窗光亮度）、aUvScale（楼层/开窗倍数）、
// aSeed（实例窗光种子）、aTwist（扭塔总扭转角，其他实例为 0）
export function ensureInstanceAttributes(geometry, count) {
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  glow.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aGlow', glow);

  if (!geometry.getAttribute('aUvScale')) {
    const uv = new THREE.InstancedBufferAttribute(new Float32Array(count * 2).fill(1), 2);
    uv.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aUvScale', uv);
  }

  if (!geometry.getAttribute('aSeed')) {
    const seed = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    seed.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aSeed', seed);
  }

  if (!geometry.getAttribute('aTwist')) {
    const twist = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    twist.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aTwist', twist);
  }
  return geometry;
}

// SECTION: sky
// 三套天色落到材质层：雨夜把商业立面往霓虹色推、并把窗光调亮；
// 清晨压暗窗光，黄昏居中。只调共享材质的参数，不新建材质（第 7.3 节）。
const SKY_MOOD = {
  dusk: { window: 1.05, neon: UNITS.neonDusk, beam: 0.26, lit: UNITS.windowLitDusk },
  night: { window: 1.55, neon: UNITS.neonNight, beam: 0.4, lit: UNITS.windowLitNight },
  morning: { window: 0.7, neon: UNITS.neonMorning, beam: 0.16, lit: UNITS.windowLitMorning }
};

export function applySkyMood(kit, skyKey) {
  const mood = SKY_MOOD[skyKey] || SKY_MOOD.dusk;

  kit.residential.emissive.set(PALETTE.residential.window);
  kit.residential.emissiveIntensity = mood.window;
  // 本轮视觉：亮灯率只改 uniform 的值，材质还是那两份共享材质
  if (kit.residential.userData.litRate) kit.residential.userData.litRate.value = mood.lit;

  const cold = new THREE.Color(PALETTE.commercial.window);
  const neon = new THREE.Color(PALETTE.commercial.neon);
  kit.commercial.emissive.copy(cold).lerp(neon, skyKey === 'night' ? 0.62 : skyKey === 'dusk' ? 0.34 : 0.1);
  kit.commercial.emissiveIntensity = mood.window * 0.95;
  if (kit.commercial.userData.litRate) kit.commercial.userData.litRate.value = mood.lit;

  kit.beam.opacity = mood.beam;
  return mood;
}