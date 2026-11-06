// SECTION: build
// 第 7 节 第 4 段：build(cityPlan, kit) -> scene object
// 只消费 CityPlan：不读文本、不取随机，同一个 plan 永远长出同一座城。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';
import {
  applySkyMood,
  createContainerTexture,
  createFacadeMaterial,
  createFacadeTexture,
  createPlainMaterial,
  createTwistDepthMaterial,
  ensureInstanceAttributes,
  whiteVertexColors
} from './materials.js';

const dummy = new THREE.Object3D();

export function createCityKit() {
  const texture = createFacadeTexture();
  const containerTexture = createContainerTexture();
  return {
    texture,
    containerTexture,
    residential: createFacadeMaterial({
      texture,
      window: PALETTE.residential.window,
      roughness: PALETTE.residential.roughness,
      metalness: PALETTE.residential.metalness
    }),
    // 商业材质同时服务普通商业楼与扭塔：
    // 普通楼 aTwist=0，扭塔按实例写入总扭转角，仍共享同一份材质。
    commercial: createFacadeMaterial({
      texture,
      window: PALETTE.commercial.window,
      roughness: PALETTE.commercial.roughness,
      metalness: PALETTE.commercial.metalness,
      twist: true
    }),
    // 这两个材质的实例都自带 instanceColor，材质底色必须是白：
    // 否则底色会和实例色相乘两次（#8f959d × #8f959d ≈ 近黑）。
    metal: createPlainMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.25,
      emissive: '#2a2216',
      emissiveIntensity: 0.25
    }),
    container: createPlainMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.2,
      map: containerTexture,
      bumpMap: containerTexture,
      bumpScale: 0.35
    }),
    plaza: createPlainMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02
    }),
    beam: new THREE.MeshBasicMaterial({
      color: 0xffe2ae,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  };
}

function createInstancedMesh(geometry, material, capacity) {
  const geo = whiteVertexColors(geometry);
  ensureInstanceAttributes(geo, capacity);
  const mesh = new THREE.InstancedMesh(geo, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // 先关剔除，等 finalize 写完完整实例矩阵并算好包围球后再打开
  mesh.frustumCulled = false;
  return mesh;
}

function writeInstance(mesh, index, position, scale, rotationY, color, glow, uvScale, extras) {
  dummy.position.set(position[0], position[1], position[2]);
  dummy.scale.set(scale[0], scale[1], scale[2]);
  dummy.rotation.set(0, rotationY || 0, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, color);

  const glowAttr = mesh.geometry.getAttribute('aGlow');
  if (glowAttr) glowAttr.array[index] = glow;
  if (uvScale) {
    const uvAttr = mesh.geometry.getAttribute('aUvScale');
    if (uvAttr) {
      uvAttr.array[index * 2] = uvScale[0];
      uvAttr.array[index * 2 + 1] = uvScale[1];
    }
  }
  if (extras) {
    const seedAttr = mesh.geometry.getAttribute('aSeed');
    if (seedAttr && extras.seed !== undefined) seedAttr.array[index] = extras.seed;
    const twistAttr = mesh.geometry.getAttribute('aTwist');
    if (twistAttr && extras.twist !== undefined) twistAttr.array[index] = extras.twist;
  }
}

function finalize(mesh, used) {
  mesh.count = Math.max(0, used);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const glowAttr = mesh.geometry.getAttribute('aGlow');
  if (glowAttr) glowAttr.needsUpdate = true;
  const uvAttr = mesh.geometry.getAttribute('aUvScale');
  if (uvAttr) uvAttr.needsUpdate = true;
  const seedAttr = mesh.geometry.getAttribute('aSeed');
  if (seedAttr) seedAttr.needsUpdate = true;
  const twistAttr = mesh.geometry.getAttribute('aTwist');
  if (twistAttr) twistAttr.needsUpdate = true;

  // 升起动画只缩小 Y、扭塔只绕 Y 旋转，都不会超出初始包围球；
  // 因此这里算一次保守包围球后就可以打开整组视锥剔除。
  if (used > 0) mesh.computeBoundingSphere();
  mesh.frustumCulled = used > 0;
  return mesh;
}

// 连续四侧面棱柱：几何本身不扭转，扭转由商业材质的 aTwist 实例属性在 shader 里完成。
// 每面 V 坐标从 0 连续到 1，再由 aUvScale.y 映射楼层，消除旧实现逐段重复的窗格。
function createTwistGeometry() {
  const segments = UNITS.twistSegments;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  // t × up = n：保证每个侧面在自身视角下都是逆时针绕向
  const sides = [
    { tangent: [1, 0, 0], normal: [0, 0, 1] },
    { tangent: [-1, 0, 0], normal: [0, 0, -1] },
    { tangent: [0, 0, -1], normal: [1, 0, 0] },
    { tangent: [0, 0, 1], normal: [-1, 0, 0] }
  ];

  sides.forEach((side) => {
    const start = vertexOffset;
    for (let j = 0; j <= segments; j += 1) {
      const y = -0.5 + j / segments;
      for (let k = 0; k < 2; k += 1) {
        const sign = k === 0 ? -0.5 : 0.5;
        positions.push(side.tangent[0] * sign, y, side.tangent[2] * sign);
        normals.push(side.normal[0], side.normal[1], side.normal[2]);
        uvs.push(k, j / segments);
      }
    }
    for (let j = 0; j < segments; j += 1) {
      const bl = start + j * 2;
      const br = bl + 1;
      const tr = bl + 3;
      const tl = bl + 2;
      indices.push(bl, br, tr, bl, tr, tl);
    }
    vertexOffset += (segments + 1) * 2;
  });

  // 顶盖单独补一片朝上的面；底面贴地不可见，省掉以减少三角形
  const cap = new THREE.PlaneGeometry(1, 1);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, 0.5, 0);
  const capPos = cap.getAttribute('position');
  const capNor = cap.getAttribute('normal');
  const capUv = cap.getAttribute('uv');
  const capIdx = cap.index;
  for (let i = 0; i < capPos.count; i += 1) {
    positions.push(capPos.getX(i), capPos.getY(i), capPos.getZ(i));
    normals.push(capNor.getX(i), capNor.getY(i), capNor.getZ(i));
    uvs.push(capUv.getX(i), capUv.getY(i));
  }
  for (let i = 0; i < capIdx.count; i += 1) indices.push(capIdx.getX(i) + vertexOffset);
  cap.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

function createPitchGeometry() {
  // 三棱柱：屋脊沿 X 轴
  const prism = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
  prism.rotateZ(Math.PI / 2);
  prism.computeVertexNormals();
  return prism;
}

export function buildCity(cityPlan, kit) {
  const group = new THREE.Group();
  group.name = 'city';

  // 三套天色落到共享材质上（第 7.3：不新建材质实例，只改参数）
  applySkyMood(kit, cityPlan.sky.key);

  const resUnits = cityPlan.units.filter((unit) => unit.district === 'residential');
  const comUnits = cityPlan.units.filter((unit) => unit.district === 'commercial');
  const pitchUnits = cityPlan.units.filter((unit) => unit.roofKind === 'pitch');
  const tankUnits = cityPlan.units.filter((unit) => unit.roofKind === 'tank');
  const flatUnits = cityPlan.units.filter(
    (unit) => unit.roofKind === 'flat' && unit.floors >= UNITS.parapetMinFloors
  );
  const tanks = cityPlan.wharves.filter((item) => item.kind === 'tank');
  const chimneys = cityPlan.wharves.filter((item) => item.kind === 'chimney');
  const containers = cityPlan.wharves.filter((item) => item.kind === 'container');

  const resBase = new THREE.Color(PALETTE.residential.wall);
  const comBase = new THREE.Color(PALETTE.commercial.wall);
  const accent = new THREE.Color(PALETTE.accent);
  const bayWidth = UNITS.storyHeight * 1.15;

  // 本轮视觉：纵深。unit.depthFade 由 plan 按「离城中心多远」算好并存进 CityPlan，
  // 这里只把颜色按它褪一点、压暗一点 —— 不新建材质，还是同一份共享材质。
  const depthFade = (base, fade) => {
    if (!fade || fade <= 0) return base;
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    base.setHSL(hsl.h, hsl.s * (1 - fade * UNITS.depthDesat), hsl.l * (1 - fade * UNITS.depthDarken));
    return base;
  };

  // ---- 住宅（西半城）+ 地标（借用住宅的暖色窗光材质，色彩由 instanceColor 给）----
  const resMesh = createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), kit.residential, resUnits.length + 2);
  let resUsed = 0;
  resUnits.forEach((unit) => {
    writeInstance(
      resMesh,
      resUsed,
      [unit.position[0], unit.height / 2, unit.position[2]],
      [unit.baseFootprint[0], unit.height, unit.baseFootprint[2]],
      unit.rotation || 0,
      depthFade(resBase.clone().offsetHSL(unit.hueOffset / 360, 0.01, 0.02), unit.depthFade),
      0.42 + unit.windowSeed * 0.58,
      [Math.max(1, Math.round(unit.baseFootprint[0] / bayWidth)), unit.floors],
      { seed: unit.windowSeed }
    );
    resUsed += 1;
  });

  const landmark = cityPlan.landmark;
  const landmarkHeight = Math.max(landmark.height, landmark.footprint * 2);
  const landmarkLowerHeight = landmarkHeight * UNITS.landmarkLowerRatio;
  const landmarkUpperHeight = landmarkHeight * UNITS.landmarkUpperRatio;
  const landmarkCrownHeight = landmarkHeight - landmarkLowerHeight - landmarkUpperHeight;
  const landmarkUpperFootprint = landmark.footprint * UNITS.landmarkUpperScale;
  const landmarkBaseColor = accent.clone().offsetHSL(landmark.hueOffset / 360, 0.05, 0.06);

  // 地标下段：保持原 footprint 与主要体量
  writeInstance(
    resMesh,
    resUsed,
    [0, landmarkLowerHeight / 2, 0],
    [landmark.footprint, landmarkLowerHeight, landmark.footprint],
    0,
    landmarkBaseColor,
    1,
    [
      Math.max(2, Math.round(landmark.footprint / bayWidth)),
      Math.max(4, Math.round(landmark.floors * UNITS.landmarkLowerRatio))
    ],
    { seed: landmark.windowSeed }
  );
  resUsed += 1;

  // 地标上段：收分退台，仍复用住宅实例组，不新增 drawcall
  writeInstance(
    resMesh,
    resUsed,
    [0, landmarkLowerHeight + landmarkUpperHeight / 2, 0],
    [landmarkUpperFootprint, landmarkUpperHeight, landmarkUpperFootprint],
    0,
    landmarkBaseColor.clone().offsetHSL(0, 0.01, 0.02),
    1,
    [
      Math.max(2, Math.round(landmarkUpperFootprint / bayWidth)),
      Math.max(3, Math.round(landmark.floors * UNITS.landmarkUpperRatio))
    ],
    { seed: landmark.windowSeed + 0.37 }
  );
  resUsed += 1;
  finalize(resMesh, resUsed);
  group.add(resMesh);

  // ---- 商业（东半城）----
  const comMesh = createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), kit.commercial, comUnits.length + 1);
  let comUsed = 0;
  comUnits.forEach((unit) => {
    writeInstance(
      comMesh,
      comUsed,
      [unit.position[0], unit.height / 2, unit.position[2]],
      [unit.baseFootprint[0], unit.height, unit.baseFootprint[2]],
      unit.rotation || 0,
      depthFade(comBase.clone().offsetHSL(unit.hueOffset / 360, 0.03, 0.03), unit.depthFade),
      0.6 + unit.windowSeed * 0.4,
      [Math.max(1, Math.round(unit.baseFootprint[0] / bayWidth)), unit.floors],
      { seed: unit.windowSeed, twist: 0 }
    );
    comUsed += 1;
  });
  finalize(comMesh, comUsed);
  group.add(comMesh);

  // ---- 圆柱组：储罐 / 烟囱 / 喷泉 / 屋顶水箱 ----
  const cylinderCapacity =
    cityPlan.plazas.length * 3 +
    tanks.length * 4 +
    chimneys.length * UNITS.chimneySegmentRatios.length +
    tankUnits.length * 2;
  const cylinderMesh = createInstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    kit.metal,
    Math.max(1, cylinderCapacity)
  );
  let cylUsed = 0;
  const metalColor = new THREE.Color(PALETTE.metal);

  cityPlan.plazas.forEach((plaza) => {
    // 广场石面已经画进地面贴图（ground.js），这里只放喷泉本体
    // 外盆：保留原有体量与高度
    writeInstance(
      cylinderMesh,
      cylUsed,
      [plaza.x, 0.13, plaza.z],
      [UNITS.fountainRadius, 0.24, UNITS.fountainRadius],
      0,
      new THREE.Color('#6f8ea3'),
      0.55,
      null
    );
    cylUsed += 1;

    // 水面：略小、很薄，与盆口齐平；升起动画按矩阵等比缩放仍保持贴合
    const waterHeight = UNITS.fountainWaterHeight;
    writeInstance(
      cylinderMesh,
      cylUsed,
      [plaza.x, 0.24 - waterHeight / 2, plaza.z],
      [UNITS.fountainRadius * UNITS.fountainWaterRadiusRatio, waterHeight, UNITS.fountainRadius * UNITS.fountainWaterRadiusRatio],
      0,
      new THREE.Color('#8fb6cd'),
      0.82,
      null
    );
    cylUsed += 1;

    // 中央水柱：顶端落在 UNITS.fountainHeight，不做透明与实时反射
    const jetHeight = Math.max(0.02, UNITS.fountainHeight - 0.24);
    writeInstance(
      cylinderMesh,
      cylUsed,
      [plaza.x, 0.24 + jetHeight / 2, plaza.z],
      [UNITS.fountainJetBottomRadius, jetHeight, UNITS.fountainJetBottomRadius],
      0,
      new THREE.Color('#b8d8ea'),
      0.95,
      null
    );
    cylUsed += 1;
  });

  tanks.forEach((tank) => {
    const bodyHeight = tank.height * UNITS.tankBodyRatio;
    const capHeight = tank.height - bodyHeight;
    const tankBaseColor = metalColor.clone();

    // 罐身
    writeInstance(
      cylinderMesh,
      cylUsed,
      [tank.position[0], bodyHeight / 2, tank.position[2]],
      [tank.radius, bodyHeight, tank.radius],
      0,
      tankBaseColor,
      0.16,
      null
    );
    cylUsed += 1;

    // 顶盖：补齐到原 tank.height，不改变语义总高
    writeInstance(
      cylinderMesh,
      cylUsed,
      [tank.position[0], bodyHeight + capHeight / 2, tank.position[2]],
      [tank.radius * 1.01, capHeight, tank.radius * 1.01],
      0,
      tankBaseColor.clone().offsetHSL(0, -0.02, 0.04),
      0.2,
      null
    );
    cylUsed += 1;

    // 两道环形加强带：只加实例，不加 drawcall
    [0.32, 0.68].forEach((ratio) => {
      writeInstance(
        cylinderMesh,
        cylUsed,
        [tank.position[0], bodyHeight * ratio, tank.position[2]],
        [tank.radius * UNITS.tankBandRadiusScale, UNITS.tankBandHeight, tank.radius * UNITS.tankBandRadiusScale],
        0,
        tankBaseColor.clone().offsetHSL(0, -0.05, -0.06),
        0.12,
        null
      );
      cylUsed += 1;
    });
  });

  chimneys.forEach((chimney) => {
    // 三段下粗上细，总高严格等于原 chimney.height
    const chimneyColor = metalColor.clone().offsetHSL(0, -0.12, -0.14);
    let cumulative = 0;
    UNITS.chimneySegmentRatios.forEach((ratio, index) => {
      const segmentHeight = chimney.height * ratio;
      const segmentRadius = chimney.radius * UNITS.chimneyRadiusScales[index];
      writeInstance(
        cylinderMesh,
        cylUsed,
        [chimney.position[0], cumulative + segmentHeight / 2, chimney.position[2]],
        [segmentRadius, segmentHeight, segmentRadius],
        0,
        chimneyColor,
        0.08,
        null
      );
      cumulative += segmentHeight;
      cylUsed += 1;
    });
  });

  tankUnits.forEach((unit) => {
    // 水箱主体 + 顶盖，总高仍为 UNITS.waterTankHeight，天线底部位置不变
    const capHeight = Math.min(
      UNITS.waterTankCapHeight,
      UNITS.waterTankHeight * (1 - UNITS.waterTankBodyRatio)
    );
    const bodyHeight = UNITS.waterTankHeight - capHeight;
    const waterColor = new THREE.Color('#9aa0a6');

    writeInstance(
      cylinderMesh,
      cylUsed,
      [unit.position[0], unit.height + bodyHeight / 2, unit.position[2]],
      [UNITS.waterTankRadius, bodyHeight, UNITS.waterTankRadius],
      0,
      waterColor,
      0.18,
      null
    );
    cylUsed += 1;

    writeInstance(
      cylinderMesh,
      cylUsed,
      [unit.position[0], unit.height + bodyHeight + capHeight / 2, unit.position[2]],
      [UNITS.waterTankRadius * 1.04, capHeight, UNITS.waterTankRadius * 1.04],
      0,
      waterColor.clone().offsetHSL(0, -0.02, 0.03),
      0.22,
      null
    );
    cylUsed += 1;
  });
  finalize(cylinderMesh, cylUsed);
  group.add(cylinderMesh);

  // ---- 集装箱 ----
  const containerMesh = createInstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    kit.container,
    Math.max(1, containers.length)
  );
  const containerColors = PALETTE.container.map((hex) => new THREE.Color(hex));
  containers.forEach((box, index) => {
    writeInstance(
      containerMesh,
      index,
      box.position,
      box.size,
      0,
      containerColors[box.colorIndex % containerColors.length],
      0.12,
      null
    );
  });
  finalize(containerMesh, containers.length);
  group.add(containerMesh);

  // ---- 针：感叹号（水箱顶上的细天线也并进这一组，几何同为细圆柱，省一次 drawcall）----
  const needleMesh = createInstancedMesh(
    new THREE.CylinderGeometry(0.09, 1, 1, 8, 1),
    kit.metal,
    Math.max(1, cityPlan.needles.length + tankUnits.length + 1)
  );
  let needleUsed = 0;
  cityPlan.needles.forEach((needle) => {
    writeInstance(
      needleMesh,
      needleUsed,
      [needle.x, needle.height / 2, needle.z],
      [needle.section / 2, needle.height, needle.section / 2],
      0,
      new THREE.Color('#62676e'),
      0.06,
      null
    );
    needleUsed += 1;
  });
  tankUnits.forEach((unit) => {
    const base = unit.height + UNITS.waterTankHeight;
    writeInstance(
      needleMesh,
      needleUsed,
      [unit.position[0], base + UNITS.antennaHeight / 2, unit.position[2]],
      [UNITS.antennaWidth, UNITS.antennaHeight, UNITS.antennaWidth],
      0,
      new THREE.Color('#b9b3a6'),
      0.16,
      null
    );
    needleUsed += 1;
  });

  // 地标顶冠：收尖段，顶端仍落在 landmarkHeight
  writeInstance(
    needleMesh,
    needleUsed,
    [0, landmarkLowerHeight + landmarkUpperHeight + landmarkCrownHeight / 2, 0],
    [landmark.footprint * UNITS.landmarkCrownScale, landmarkCrownHeight, landmark.footprint * UNITS.landmarkCrownScale],
    0,
    new THREE.Color('#d8b672'),
    0.35,
    null
  );
  needleUsed += 1;
  finalize(needleMesh, needleUsed);
  group.add(needleMesh);

  // ---- 扭塔：问号 ----
  const towerMesh = createInstancedMesh(
    createTwistGeometry(),
    kit.commercial,
    Math.max(1, cityPlan.towers.length)
  );
  // 深度材质与可见几何执行同样的实例扭转，保证阴影一致
  towerMesh.customDepthMaterial = createTwistDepthMaterial();
  towerMesh.userData.ownDepthMaterial = true;
  cityPlan.towers.forEach((tower, index) => {
    const height = tower.floors * UNITS.storyHeight;
    const totalTwist = tower.twist * Math.max(0, tower.floors - 1);
    const towerSeed = Math.abs(
      Math.sin(tower.twist * 127.1 + tower.floors * 13.7 + tower.x * 0.017 + tower.z * 0.009)
    ) % 1;
    writeInstance(
      towerMesh,
      index,
      [tower.x, height / 2, tower.z],
      [tower.footprint, height, tower.footprint],
      0,
      new THREE.Color('#5b6572'),
      0.85,
      [2, Math.max(4, tower.floors)],
      { seed: towerSeed, twist: totalTwist }
    );
  });
  finalize(towerMesh, cityPlan.towers.length);
  group.add(towerMesh);

  // ---- 坡顶 ----
  const pitchMesh = createInstancedMesh(createPitchGeometry(), kit.metal, Math.max(1, pitchUnits.length));
  pitchUnits.forEach((unit, index) => {
    writeInstance(
      pitchMesh,
      index,
      [unit.position[0], unit.height, unit.position[2]],
      [Math.max(0.6, unit.baseFootprint[0] * 1.06), UNITS.pitchRoofHeight * 2, Math.max(0.6, unit.baseFootprint[2] * 1.06)],
      unit.rotation || 0,
      new THREE.Color('#6b5a4d'),
      0.04,
      null
    );
  });
  finalize(pitchMesh, pitchUnits.length);
  group.add(pitchMesh);

  // ---- 引号围墙：四面矮墙围出一块引用区；平屋顶檐口也复用这一组 ----
  const wallMesh = createInstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    kit.plaza,
    Math.max(1, cityPlan.walls.length * 4 + flatUnits.length * 4)
  );
  let wallUsed = 0;
  cityPlan.walls.forEach((wall) => {
    const half = wall.size / 2;
    const sides = [
      [wall.x - half, wall.z, wall.thickness, wall.size],
      [wall.x + half, wall.z, wall.thickness, wall.size],
      [wall.x, wall.z - half, wall.size, wall.thickness],
      [wall.x, wall.z + half, wall.size, wall.thickness]
    ];
    sides.forEach((side) => {
      writeInstance(
        wallMesh,
        wallUsed,
        [side[0], wall.height / 2, side[1]],
        [side[2], wall.height, side[3]],
        0,
        new THREE.Color('#8c8578'),
        0.04,
        null
      );
      wallUsed += 1;
    });
  });

  // 平屋顶护边：四条窄檐口跟随楼体旋转，不超出建筑外包络太多
  flatUnits.forEach((unit) => {
    const rotation = unit.rotation || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const width = unit.baseFootprint[0] + UNITS.parapetOverhang * 2;
    const depth = unit.baseFootprint[2] + UNITS.parapetOverhang * 2;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const localSides = [
      { x: -halfWidth, z: 0, scale: [UNITS.parapetThickness, UNITS.parapetHeight, depth] },
      { x: halfWidth, z: 0, scale: [UNITS.parapetThickness, UNITS.parapetHeight, depth] },
      { x: 0, z: -halfDepth, scale: [width, UNITS.parapetHeight, UNITS.parapetThickness] },
      { x: 0, z: halfDepth, scale: [width, UNITS.parapetHeight, UNITS.parapetThickness] }
    ];
    localSides.forEach((side) => {
      const x = unit.position[0] + side.x * cos + side.z * sin;
      const z = unit.position[2] - side.x * sin + side.z * cos;
      writeInstance(
        wallMesh,
        wallUsed,
        [x, unit.height + UNITS.parapetHeight / 2 - 0.015, z],
        side.scale,
        rotation,
        new THREE.Color('#8c8578'),
        0.04,
        null
      );
      wallUsed += 1;
    });
  });
  finalize(wallMesh, wallUsed);
  group.add(wallMesh);

  // ---- 地标光柱 + 点光 ----
  // 本轮视觉：光柱只在黄昏与雨夜出现；清晨是白天，一道光柱会把柔光打回「夜景观感」。
  if (cityPlan.sky.key !== 'morning') {
    const beamHeight = Math.max(6, landmarkHeight * UNITS.beamHeightScale);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(UNITS.beamRadiusTop, UNITS.beamRadiusBottom, 1, 8, 1, true),
      kit.beam
    );
    beam.position.set(0, landmarkHeight + beamHeight / 2, 0);
    beam.scale.set(1, beamHeight, 1);
    beam.renderOrder = 4;
    beam.name = 'beam';
    group.add(beam);
  }

  const landmarkLight = new THREE.PointLight(
    new THREE.Color(PALETTE.accent),
    UNITS.landmarkLightIntensity,
    cityPlan.radius * UNITS.landmarkLightRange,
    2
  );
  landmarkLight.position.set(0, landmarkHeight * 0.85, 0);
  group.add(landmarkLight);

  // 升起动画要按实例逐栋做，标记一下哪些网格参与（第 10 节「升起动画」）
  group.traverse((object) => {
    if (object.isInstancedMesh) object.userData.rise = true;
  });

  return {
    group,
    drawCalls: group.children.filter((child) => child.isMesh || child.isInstancedMesh).length,
    landmarkHeight,
    landmarkLight
  };
}

export function disposeCity(group) {
  if (!group) return;
  group.traverse((object) => {
    if (object.isMesh || object.isInstancedMesh) {
      // 材质由 kit 共享，这里只回收城市自有的几何体与深度材质
      if (object.geometry && object.geometry.dispose) object.geometry.dispose();
      if (object.userData.ownDepthMaterial && object.customDepthMaterial) {
        object.customDepthMaterial.dispose();
      }
    }
  });
}
