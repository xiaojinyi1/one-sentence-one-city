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
  // 新增地面细节使用独立随机源，不消耗上面的 rng 序列，
  // 保证原有水痕、噪点和 CityPlan 的确定性完全不变。
  const detailRng = createRng((cityPlan.seed ^ 0x7a3f91c) >>> 0);

  // 城外深、城内亮。整张画布一起渐变（不是画一个圆盘），
  // 这样可见的地面不会出现「亮圆盘 / 暗外围」的硬边。
  ctx.fillStyle = '#4a4e57';
  ctx.fillRect(0, 0, size, size);

  const disc = ctx.createRadialGradient(center, center, 0, center, center, radius * scale * UNITS.groundScale);
  disc.addColorStop(0, '#8a8e97');
  disc.addColorStop(0.45, '#666a74');
  disc.addColorStop(0.78, '#51555f');
  disc.addColorStop(1, '#4a4e57');
  ctx.fillStyle = disc;
  ctx.fillRect(0, 0, size, size);

  // 港区 / 主干道 / 断口：单城时按 cityPlan.avenue 画一套；
  // 第 18 节 P1 的双城视图把两座城各算成一条 spine，一次画进同一张贴图。
  const hasPort = cityPlan.wharves.length > 0;
  const spines = cityPlan.spines || [
    {
      x: 0,
      radius,
      half: cityPlan.avenue.half,
      portStart: cityPlan.avenue.portStart,
      port: hasPort,
      gaps: cityPlan.roadGaps
    }
  ];

  spines.forEach((spine) => {
    const half = spine.half;
    const avenueWidth = half * 2;
    const port = spine.port === undefined ? hasPort : spine.port;

    // 港区：只有句子里真的出现数字 / 网址时才有沥青域（R7），
    // 否则空着一大片深色地面，看上去像地上的阴影。
    if (port) {
      ctx.fillStyle = '#565a64';
      ctx.fillRect(
        toX(spine.x - spine.radius * 0.95),
        toY(spine.portStart),
        spine.radius * 1.9 * scale,
        spine.radius * 0.95 * scale
      );
    }

    // 主干道（沿南北）—— 比地面略亮，才看得出是一条路
    ctx.fillStyle = '#8f949e';
    ctx.fillRect(
      toX(spine.x - half),
      toY(-spine.radius),
      avenueWidth * scale,
      (spine.radius + spine.portStart) * scale
    );

    // 港区横向分隔路
    if (port) {
      const portRoadZ = spine.portStart - UNITS.plotGap * 2;
      ctx.fillRect(
        toX(spine.x - spine.radius * 0.9),
        toY(portRoadZ),
        spine.radius * 1.8 * scale,
        0.9 * scale
      );
    }

    // 主干道两侧路缘线：极低对比，只给道路一个收边
    const curbWidth = Math.max(1, 0.07 * scale);
    const roadTop = toY(-spine.radius);
    const roadHeight = (spine.radius + spine.portStart) * scale;
    ctx.fillStyle = 'rgba(238,232,214,0.16)';
    ctx.fillRect(toX(spine.x - half), roadTop, curbWidth, roadHeight);
    ctx.fillRect(toX(spine.x + half) - curbWidth, roadTop, curbWidth, roadHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(toX(spine.x - half) + curbWidth, roadTop, Math.max(1, curbWidth * 0.6), roadHeight);
    ctx.fillRect(toX(spine.x + half) - curbWidth * 1.6, roadTop, Math.max(1, curbWidth * 0.6), roadHeight);

    // 港区铺装接缝：稀疏横缝 + 轻微磨损，不改变道路与港区位置
    if (port) {
      const seamTop = spine.portStart;
      const seamBottom = spine.portStart + spine.radius * 0.82;
      for (let z = seamTop; z < seamBottom; z += 0.82) {
        const alpha = 0.05 + detailRng.unit() * 0.05;
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(
          toX(spine.x - spine.radius * 0.88),
          toY(z),
          spine.radius * 1.76 * scale,
          Math.max(1, 0.035 * scale)
        );
      }
    }

    // 句号断口 + 斑马线
    (spine.gaps || []).forEach((gap) => {
      const gapY = toY(gap.z);
      const gapH = gap.width * scale;
      ctx.fillStyle = '#a3a8b2';
      ctx.fillRect(toX(spine.x - half), gapY - gapH / 2, avenueWidth * scale, gapH);

      const stripes = gap.stripes;
      const barH = gapH / (stripes * 2);
      ctx.fillStyle = 'rgba(238, 232, 214, 0.62)';
      for (let i = 0; i < stripes; i += 1) {
        ctx.fillRect(
          toX(spine.x - half * 0.92),
          gapY - gapH / 2 + i * barH * 2 + barH * 0.5,
          avenueWidth * 0.92 * scale,
          barH
        );
      }
    });
  });

  // 广场石面：比地坪亮一点，才像铺出来的石板，而不是地上一个洞
  cityPlan.plazas.forEach((plaza) => {
    ctx.fillStyle = '#a6aab2';
    ctx.beginPath();
    ctx.arc(toX(plaza.x), toY(plaza.z), plaza.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 66, 60, 0.35)';
    ctx.lineWidth = Math.max(1, 0.04 * scale);
    ctx.beginPath();
    ctx.arc(toX(plaza.x), toY(plaza.z), plaza.radius * 0.9 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // 轻量铺装缝：固定角度的放射缝 + 两条同心缝，避免大面积纯色
    const cx = toX(plaza.x);
    const cy = toY(plaza.z);
    ctx.strokeStyle = 'rgba(70, 66, 60, 0.16)';
    ctx.lineWidth = Math.max(1, 0.018 * scale);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + detailRng.unit() * 0.08;
      const inner = plaza.radius * 0.18 * scale;
      const outer = plaza.radius * 0.86 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
    }
    [0.42, 0.66].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(cx, cy, plaza.radius * ratio * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
  });

  // 接触阴影：每栋楼底部一圈 CanvasTexture 径向渐变（第 10 节，opacity 0.35）。
  // 烘进地面贴图而不是单独一张贴图物件，是为了守住 drawcall ≤12 的预算。
  const shadowAlpha = cityPlan.sky.key === 'morning' ? UNITS.contactShadowOpacity * 0.7 : UNITS.contactShadowOpacity;
  const contactPoints = []
    .concat(
      cityPlan.units.map((unit) => ({
        x: unit.position[0],
        z: unit.position[2],
        r: Math.max(unit.baseFootprint[0], unit.baseFootprint[2]) * UNITS.contactShadowScale
      }))
    )
    .concat([
      {
        x: cityPlan.landmark.position[0],
        z: cityPlan.landmark.position[2],
        r: cityPlan.landmark.footprint * UNITS.contactShadowScale * 1.2
      }
    ])
    .concat(
      cityPlan.wharves.map((item) => ({
        x: item.position[0],
        z: item.position[2],
        r: (item.radius ? item.radius * 2 : Math.max(item.size[0], item.size[2])) * UNITS.contactShadowScale
      }))
    )
    // 本轮视觉：留白的地块只有一圈接触阴影，没有建筑
    .concat(
      (cityPlan.emptyLots || []).map((lot) => ({
        x: lot.position[0],
        z: lot.position[2],
        r: lot.footprint * UNITS.contactShadowScale
      }))
    );

  contactPoints.forEach((point) => {
    const cx = toX(point.x);
    const cy = toY(point.z);
    const r = Math.max(2, point.r * 0.5 * scale);
    const shade = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, r);
    shade.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
    shade.addColorStop(0.55, `rgba(0, 0, 0, ${shadowAlpha * 0.45})`);
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 雨夜：路面湿反射靠画几道冷光水痕强化（材质上再把 roughness 压下去）
  if (cityPlan.sky.key === 'night') {
    for (let i = 0; i < 26; i += 1) {
      const x = toX(rng.range(-cityPlan.avenue.half, cityPlan.avenue.half));
      const y = toY(rng.range(-cityPlan.radius * 0.9, cityPlan.radius * 0.4));
      const w = rng.range(2, 9);
      const h = rng.range(20, 70);
      const streak = ctx.createLinearGradient(x, y, x, y + h);
      streak.addColorStop(0, 'rgba(150, 190, 255, 0.16)');
      streak.addColorStop(1, 'rgba(150, 190, 255, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(x, y, w, h);
    }
  }

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

  // 地面底色跟天色走：贴图是中性灰，颜色靠 tint 乘上去（不引外部贴图）
  const tint = new THREE.Color(PALETTE.sky[cityPlan.sky.key].ground || '#101218');
  tint.lerp(new THREE.Color('#ffffff'), UNITS.groundTintLerp);

  // 雨夜档：地面 roughness 压低做湿反射，metalness 略抬，不引任何后期处理
  const wet = cityPlan.sky.key === 'night';

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: tint,
    roughness: wet ? UNITS.wetRoughness : 0.96,
    metalness: wet ? UNITS.wetMetalness : 0.02
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
