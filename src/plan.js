// SECTION: plan
// 第 7 节 第 3 段：plan(features, seed) -> CityPlan
// 纯数据：可以 JSON.stringify 进调试面板，build 阶段只读它，不回推文本。

import { UNITS } from './constants.js';
import { createRng } from './seed.js';
import {
  ruleR1,
  ruleR2Floors,
  ruleR2Landmark,
  ruleR3,
  ruleR4,
  ruleR5Hue,
  ruleR5Roof,
  ruleR6,
  ruleR7,
  ruleR8,
  clamp
} from './rules.js';
import { buildSlots, makeBlocker, round, spreadOrder } from './layout.js';

const MAX_BUILDINGS = UNITS.instanceCap;

export function plan(features, seed) {
  const rng = createRng(seed);
  const radius = ruleR1(features);
  const shape = ruleR8(features);
  const skyKey = ruleR6(features);
  const marks = ruleR3(features);
  const order = ruleR4(features.tokens);
  const portRule = ruleR7(features);
  const grid = buildSlots(radius, shape.plotSize);
  const plotRadius = shape.plotSize * 0.5;

  // ---- 特殊地物先落位，它们占的地块不再起楼 ----
  const plazas = [];
  for (let i = 0; i < marks.plazas; i += 1) {
    const spread = marks.plazas === 1 ? 0 : i / (marks.plazas - 1) - 0.5;
    const side = i % 2 === 0 ? -1 : 1;
    plazas.push({
      x: round(side * (grid.avenueHalf + UNITS.plazaRadius * 0.92)),
      z: round(spread * radius * 0.72),
      radius: UNITS.plazaRadius,
      fountain: true
    });
  }

  const needles = [];
  const perColumn = Math.min(6, Math.max(1, marks.needles));
  for (let i = 0; i < marks.needles; i += 1) {
    const column = Math.floor(i / perColumn);
    const row = i % perColumn;
    const z =
      -radius * 0.34 -
      (perColumn === 1 ? radius * 0.2 : row * ((radius * 0.46) / (perColumn - 1)));
    needles.push({
      x: round((column % 2 === 0 ? -1 : 1) * (grid.avenueHalf + UNITS.needleSection)),
      z: round(z),
      height: UNITS.needleHeight,
      section: UNITS.needleSection
    });
  }

  const towers = [];
  for (let i = 0; i < marks.twists; i += 1) {
    towers.push({
      x: 0,
      z: round(radius * (0.1 + i * 0.085)),
      floors: UNITS.towerFloorsBase + i * UNITS.towerFloorsStep,
      twist: round(UNITS.twistFloorRad * (1 + i * 0.25)),
      footprint: UNITS.towerFootprint
    });
  }

  const walls = [];
  for (let i = 0; i < marks.walls; i += 1) {
    walls.push({
      x: round(clamp(radius * (0.44 + i * 0.24), -radius * 0.78, radius * 0.78)),
      z: round(-radius * (0.42 + i * 0.14)),
      size: round(radius * UNITS.wallSizeRatio * 2),
      height: UNITS.wallHeight,
      thickness: UNITS.wallThickness
    });
  }

  // ---- 地标：末位 token，全城唯一，最高，带光柱 ----
  const landmarkFloors = ruleR2Landmark(ruleR2Floors(features.topFrequency, rng), shape.floorScale);
  const landmark = {
    token: order.landmarkToken,
    position: [0, 0, 0],
    floors: landmarkFloors,
    footprint: round(shape.plotSize * UNITS.landmarkFootprint),
    height: round(landmarkFloors * UNITS.storyHeight),
    hueOffset: round(ruleR5Hue(rng)),
    windowSeed: round(rng.unit()),
    beacon: true
  };

  const zones = {
    circles: plazas
      .map((p) => ({ x: p.x, z: p.z, r: p.radius }))
      .concat(towers.map((t) => ({ x: t.x, z: t.z, r: t.footprint * 0.75 })))
      .concat(needles.map((n) => ({ x: n.x, z: n.z, r: n.section })))
      .concat([{ x: 0, z: 0, r: landmark.footprint * 0.75 }]),
    boxes: walls.map((w) => ({ x: w.x, z: w.z, half: w.size / 2 + w.thickness }))
  };
  const isBlocked = makeBlocker(zones);
  const free = grid.slots.filter((slot) => !isBlocked(slot.x, slot.z, plotRadius));

  // ---- R4：前半句住宅、后半句商业；楼少时摊开铺满各自半边 ----
  const residentialSlots = spreadOrder(
    free.filter((slot) => slot.district === 'residential'),
    -radius * 0.5,
    0
  );
  const commercialSlots = spreadOrder(
    free.filter((slot) => slot.district === 'commercial'),
    radius * 0.5,
    0
  );

  const queues = { residential: residentialSlots, commercial: commercialSlots };
  const cursor = { residential: 0, commercial: 0 };
  const units = [];
  const tokens = features.tokens;
  let dropped = 0;

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const district = i < order.splitIndex ? 'residential' : 'commercial';
    const queue = queues[district];
    if (units.length >= MAX_BUILDINGS || cursor[district] >= queue.length) {
      dropped += 1;
      continue;
    }

    const slot = queue[cursor[district]];
    cursor[district] += 1;
    const token = tokens[i];
    const freq = features.freq.get(token) || 1;
    const floors = ruleR2Floors(freq, rng);
    const height = round(floors * UNITS.storyHeight * shape.floorScale);
    const fill = shape.plotSize * UNITS.buildingFill;

    units.push({
      token,
      freq,
      district,
      position: [slot.x, 0, slot.z],
      baseFootprint: [round(fill * rng.range(0.86, 1)), height, round(fill * rng.range(0.86, 1))],
      floors,
      height,
      roofKind: ruleR5Roof(rng),
      hueOffset: round(ruleR5Hue(rng)),
      windowSeed: round(rng.unit())
    });
  }

  // ---- R7：城南港区，储罐 / 烟囱 / 集装箱 ----
  const portSlots = spreadOrder(
    free.filter((slot) => slot.district === 'port'),
    0,
    radius * 0.72
  );
  const wharves = [];
  let portCursor = 0;

  const tankWanted = Math.min(portRule.tanks, portSlots.length);
  for (let i = 0; i < tankWanted; i += 1) {
    const slot = portSlots[portCursor];
    portCursor += 1;
    if (i % 3 === 2) {
      wharves.push({
        kind: 'chimney',
        position: [slot.x, 0, slot.z],
        radius: UNITS.chimneyRadius,
        height: UNITS.chimneyHeight
      });
    } else {
      wharves.push({
        kind: 'tank',
        position: [slot.x, 0, slot.z],
        radius: UNITS.tankRadius,
        height: UNITS.tankHeight
      });
    }
  }

  const restSlots = portSlots.slice(portCursor);
  const capacity = restSlots.length * UNITS.containerStack;
  const containerCount = Math.min(portRule.containers, capacity);
  const boxWidth = Math.min(UNITS.containerW, grid.step * 0.92);
  for (let i = 0; i < containerCount; i += 1) {
    const slot = restSlots[Math.floor(i / UNITS.containerStack)];
    const level = i % UNITS.containerStack;
    wharves.push({
      kind: 'container',
      position: [
        round(slot.x + rng.range(-0.08, 0.08)),
        round(UNITS.containerH * (level + 0.5)),
        round(slot.z + rng.range(-0.08, 0.08))
      ],
      size: [
        round(boxWidth),
        round(UNITS.containerH),
        round(Math.min(UNITS.containerD, grid.step * 0.62))
      ],
      colorIndex: Math.floor(rng.unit() * 6)
    });
  }

  // ---- R3：句号在主干道上打断口，断口铺斑马线 ----
  const roadGaps = [];
  for (let i = 0; i < marks.gaps; i += 1) {
    const spread = marks.gaps === 1 ? 0 : i / (marks.gaps - 1) - 0.5;
    roadGaps.push({
      z: round(spread * radius * 0.82),
      width: UNITS.roadGapWidth,
      stripes: UNITS.crosswalkStripes
    });
  }

  const countOf = (kind) => wharves.filter((item) => item.kind === kind).length;

  return {
    seed,
    radius,
    plotCount: units.length,
    shape,
    sky: {
      key: skyKey,
      sentimentScore: features.sentimentScore,
      topToken: features.topToken,
      topFrequency: features.topFrequency
    },
    avenue: { half: grid.avenueHalf, portStart: grid.portStart },
    districts: [
      {
        name: 'residential',
        center: [round(-radius * 0.5), 0],
        slots: residentialSlots.length,
        built: cursor.residential
      },
      {
        name: 'commercial',
        center: [round(radius * 0.5), 0],
        slots: commercialSlots.length,
        built: cursor.commercial
      },
      {
        name: 'port',
        center: [0, round(radius * 0.72)],
        slots: portSlots.length,
        built: countOf('tank') + countOf('chimney') + countOf('container')
      }
    ],
    units,
    landmark,
    plazas,
    needles,
    towers,
    walls,
    wharves,
    roadGaps,
    stats: {
      tokens: features.tokenCount,
      buildings: units.length,
      dropped,
      tanks: countOf('tank'),
      chimneys: countOf('chimney'),
      containers: countOf('container'),
      omitted: marks.omitted
    }
  };
}
