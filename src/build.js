// SECTION: build
// 第 7 节 第 4 段：build(cityPlan, kit) -> scene object
// 只消费 CityPlan：不读文本、不取随机，同一个 plan 永远长出同一座城。

import * as THREE from 'three';
import { PALETTE, UNITS } from './constants.js';
import {
  createFacadeMaterial,
  createFacadeTexture,
  createPlainMaterial,
  ensureInstanceAttributes,
  whiteVertexColors
} from './materials.js';

const dummy = new THREE.Object3D();

export function createCityKit() {
  const texture = createFacadeTexture();
  return {
    texture,
    residential: createFacadeMaterial({
      texture,
      window: PALETTE.residential.window,
      roughness: PALETTE.residential.roughness,
      metalness: PALETTE.residential.metalness
    }),
    commercial: createFacadeMaterial({
      texture,
      window: PALETTE.commercial.window,
      roughness: PALETTE.commercial.roughness,
      metalness: PALETTE.commercial.metalness
    }),
    metal: createPlainMaterial({
      color: PALETTE.metal,
      roughness: 0.42,
      metalness: 0.55,
      emissive: '#2a2216',
      emissiveIntensity: 0.25
    }),
    container: createPlainMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.2
    }),
    plaza: createPlainMaterial({
      color: PALETTE.plazaStone,
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
  mesh.frustumCulled = false;
  return mesh;
}

function writeInstance(mesh, index, position, scale, rotationY, color, glow, uvScale) {
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
}

function finalize(mesh, used) {
  mesh.count = Math.max(0, used);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const glowAttr = mesh.geometry.getAttribute('aGlow');
  if (glowAttr) glowAttr.needsUpdate = true;
  const uvAttr = mesh.geometry.getAttribute('aUvScale');
  if (uvAttr) uvAttr.needsUpdate = true;
  return mesh;
}

// 把若干 BoxGeometry 拼成一段扭塔：逐段绕 Y 轴偏一点，堆成扭转的柱体
function createTwistGeometry() {
  const segments = 14;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  for (let i = 0; i < segments; i += 1) {
    const part = new THREE.BoxGeometry(1, 1 / segments, 1);
    part.rotateY(i * 0.24);
    part.translate(0, (i + 0.5) / segments - 0.5, 0);

    const pos = part.getAttribute('position');
    const nor = part.getAttribute('normal');
    const uv = part.getAttribute('uv');
    const idx = part.index;

    for (let k = 0; k < pos.count; k += 1) {
      positions.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      normals.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      uvs.push(uv.getX(k), uv.getY(k));
    }
    for (let k = 0; k < idx.count; k += 1) indices.push(idx.getX(k) + vertexOffset);
    vertexOffset += pos.count;
    part.dispose();
  }

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

  const resUnits = cityPlan.units.filter((unit) => unit.district === 'residential');
  const comUnits = cityPlan.units.filter((unit) => unit.district === 'commercial');
  const pitchUnits = cityPlan.units.filter((unit) => unit.roofKind === 'pitch');
  const tankUnits = cityPlan.units.filter((unit) => unit.roofKind === 'tank');
  const tanks = cityPlan.wharves.filter((item) => item.kind === 'tank');
  const chimneys = cityPlan.wharves.filter((item) => item.kind === 'chimney');
  const containers = cityPlan.wharves.filter((item) => item.kind === 'container');

  const resBase = new THREE.Color(PALETTE.residential.wall);
  const comBase = new THREE.Color(PALETTE.commercial.wall);
  const accent = new THREE.Color(PALETTE.accent);
  const bayWidth = UNITS.storyHeight * 1.15;

  // ---- 住宅（西半城）+ 地标（借用住宅的暖色窗光材质，色彩由 instanceColor 给）----
  const resMesh = createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), kit.residential, resUnits.length + 1);
  let resUsed = 0;
  resUnits.forEach((unit) => {
    writeInstance(
      resMesh,
      resUsed,
      [unit.position[0], unit.height / 2, unit.position[2]],
      [unit.baseFootprint[0], unit.height, unit.baseFootprint[2]],
      0,
      resBase.clone().offsetHSL(unit.hueOffset / 360, 0.01, 0.02),
      0.42 + unit.windowSeed * 0.58,
      [Math.max(1, Math.round(unit.baseFootprint[0] / bayWidth)), unit.floors]
    );
    resUsed += 1;
  });

  const landmark = cityPlan.landmark;
  const landmarkHeight = Math.max(landmark.height, landmark.footprint * 2);
  writeInstance(
    resMesh,
    resUsed,
    [0, landmarkHeight / 2, 0],
    [landmark.footprint, landmarkHeight, landmark.footprint],
    0,
    accent.clone().offsetHSL(landmark.hueOffset / 360, 0.05, 0.06),
    1,
    [Math.max(2, Math.round(landmark.footprint / bayWidth)), Math.max(4, landmark.floors)]
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
      0,
      comBase.clone().offsetHSL(unit.hueOffset / 360, 0.03, 0.03),
      0.6 + unit.windowSeed * 0.4,
      [Math.max(1, Math.round(unit.baseFootprint[0] / bayWidth)), unit.floors]
    );
    comUsed += 1;
  });
  finalize(comMesh, comUsed);
  group.add(comMesh);

  // ---- 圆柱组：储罐 / 烟囱 / 喷泉 / 水箱 / 广场石盘 ----
  const cylinderCapacity =
    tanks.length + chimneys.length + cityPlan.plazas.length * 2 + tankUnits.length;
  const cylinderMesh = createInstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    kit.metal,
    Math.max(1, cylinderCapacity)
  );
  let cylUsed = 0;
  const metalColor = new THREE.Color(PALETTE.metal);

  cityPlan.plazas.forEach((plaza) => {
    writeInstance(
      cylinderMesh,
      cylUsed,
      [plaza.x, 0.03, plaza.z],
      [plaza.radius, 0.06, plaza.radius],
      0,
      new THREE.Color(PALETTE.plazaStone),
      0.06,
      null
    );
    cylUsed += 1;
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
  });

  tanks.forEach((tank) => {
    writeInstance(
      cylinderMesh,
      cylUsed,
      [tank.position[0], tank.height / 2, tank.position[2]],
      [tank.radius, tank.height, tank.radius],
      0,
      metalColor.clone(),
      0.16,
      null
    );
    cylUsed += 1;
  });

  chimneys.forEach((chimney) => {
    writeInstance(
      cylinderMesh,
      cylUsed,
      [chimney.position[0], chimney.height / 2, chimney.position[2]],
      [chimney.radius, chimney.height, chimney.radius],
      0,
      metalColor.clone().offsetHSL(0, -0.12, -0.14),
      0.08,
      null
    );
    cylUsed += 1;
  });

  tankUnits.forEach((unit) => {
    writeInstance(
      cylinderMesh,
      cylUsed,
      [unit.position[0], unit.height + UNITS.waterTankHeight / 2, unit.position[2]],
      [UNITS.waterTankRadius, UNITS.waterTankHeight, UNITS.waterTankRadius],
      0,
      new THREE.Color('#9aa0a6'),
      0.18,
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

  // ---- 针：感叹号 ----
  const needleMesh = createInstancedMesh(
    new THREE.CylinderGeometry(0.09, 1, 1, 8, 1),
    kit.metal,
    Math.max(1, cityPlan.needles.length)
  );
  cityPlan.needles.forEach((needle, index) => {
    writeInstance(
      needleMesh,
      index,
      [needle.x, needle.height / 2, needle.z],
      [needle.section / 2, needle.height, needle.section / 2],
      0,
      new THREE.Color('#d9d3c6'),
      0.1,
      null
    );
  });
  finalize(needleMesh, cityPlan.needles.length);
  group.add(needleMesh);

  // ---- 扭塔：问号 ----
  const towerMesh = createInstancedMesh(
    createTwistGeometry(),
    kit.commercial,
    Math.max(1, cityPlan.towers.length)
  );
  cityPlan.towers.forEach((tower, index) => {
    const height = tower.floors * UNITS.storyHeight;
    writeInstance(
      towerMesh,
      index,
      [tower.x, height / 2, tower.z],
      [tower.footprint, height, tower.footprint],
      0,
      new THREE.Color('#5b6572'),
      0.85,
      [2, Math.max(4, tower.floors)]
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
      0,
      new THREE.Color('#6b5a4d'),
      0.04,
      null
    );
  });
  finalize(pitchMesh, pitchUnits.length);
  group.add(pitchMesh);

  // ---- 天线：水箱顶上的细杆 ----
  const antennaMesh = createInstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1),
    kit.metal,
    Math.max(1, tankUnits.length)
  );
  tankUnits.forEach((unit, index) => {
    const base = unit.height + UNITS.waterTankHeight;
    writeInstance(
      antennaMesh,
      index,
      [unit.position[0], base + UNITS.antennaHeight / 2, unit.position[2]],
      [UNITS.antennaWidth, UNITS.antennaHeight, UNITS.antennaWidth],
      0,
      new THREE.Color('#b9b3a6'),
      0.16,
      null
    );
  });
  finalize(antennaMesh, tankUnits.length);
  group.add(antennaMesh);

  // ---- 引号围墙：四面矮墙围出一块引用区 ----
  const wallMesh = createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), kit.plaza, Math.max(1, cityPlan.walls.length * 4));
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
  finalize(wallMesh, wallUsed);
  group.add(wallMesh);

  // ---- 地标光柱 + 点光 ----
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

  const landmarkLight = new THREE.PointLight(
    new THREE.Color(PALETTE.accent),
    UNITS.landmarkLightIntensity,
    cityPlan.radius * 2.4,
    2
  );
  landmarkLight.position.set(0, landmarkHeight * 0.85, 0);
  group.add(landmarkLight);

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
      // 材质由 kit 共享，这里只回收几何体
      if (object.geometry && object.geometry.dispose) object.geometry.dispose();
    }
  });
}
