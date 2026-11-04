// SECTION: layout
// 第 7 节 plan 阶段的落位辅助：把半径切成地块网格，按 R4 的分区归类，
// 并按「离各自分区中心由近到远」给出确定性的排布顺序。

import { UNITS } from './constants.js';

const PRE = 10000;
const round = (value) => Math.round(value * PRE) / PRE;

export function buildSlots(radius, plotSize) {
  const step = plotSize + UNITS.plotGap;
  const limit = radius * UNITS.plotAreaFill;
  const portStart = radius * UNITS.portOffset;
  const avenueHalf = Math.max(UNITS.avenueHalf, radius * UNITS.avenueWidthRatio);
  const half = Math.ceil(limit / step);
  const slots = [];

  for (let gx = -half; gx <= half; gx += 1) {
    for (let gz = -half; gz <= half; gz += 1) {
      const x = round(gx * step);
      const z = round(gz * step);
      if (x * x + z * z > limit * limit) continue;

      let district;
      if (z > portStart) district = 'port';
      else if (z > portStart - step) district = 'avenue';
      else if (Math.abs(x) < avenueHalf + plotSize * 0.5) district = 'avenue';
      else district = x < 0 ? 'residential' : 'commercial';

      slots.push({ x, z, district });
    }
  }

  return { step, limit, portStart, avenueHalf, slots };
}

export function sortByDistance(slots, centerX, centerZ) {
  return slots.slice().sort((a, b) => {
    const da = (a.x - centerX) * (a.x - centerX) + (a.z - centerZ) * (a.z - centerZ);
    const db = (b.x - centerX) * (b.x - centerX) + (b.z - centerZ) * (b.z - centerZ);
    if (da !== db) return da - db;
    if (a.z !== b.z) return a.z - b.z;
    return a.x - b.x;
  });
}

// 街区里只放几栋楼时，从中心往外排会挤成一团；改用「最远点采样」把它们摊开，
// 让半座城真的铺满半边，而不是在地标旁边堆一小撮。
export function spreadOrder(slots, centerX, centerZ) {
  if (slots.length <= 1) return slots.slice();

  const remaining = slots.slice().sort((a, b) => {
    const da = (a.x - centerX) * (a.x - centerX) + (a.z - centerZ) * (a.z - centerZ);
    const db = (b.x - centerX) * (b.x - centerX) + (b.z - centerZ) * (b.z - centerZ);
    if (da !== db) return da - db;
    if (a.z !== b.z) return a.z - b.z;
    return a.x - b.x;
  });

  const picked = [remaining.shift()];
  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      let nearest = Infinity;
      for (let p = 0; p < picked.length; p += 1) {
        const dx = picked[p].x - candidate.x;
        const dz = picked[p].z - candidate.z;
        const distance = dx * dx + dz * dz;
        if (distance < nearest) nearest = distance;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        bestIndex = i;
      }
    }
    picked.push(remaining.splice(bestIndex, 1)[0]);
  }

  return picked;
}

// 特殊地物占地：楼不允许压在这些东西上
export function makeBlocker(zones) {
  const circles = zones.circles || [];
  const boxes = zones.boxes || [];

  return function isBlocked(x, z, plotRadius) {
    for (let i = 0; i < circles.length; i += 1) {
      const c = circles[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const reach = c.r + plotRadius;
      if (dx * dx + dz * dz < reach * reach) return true;
    }
    for (let i = 0; i < boxes.length; i += 1) {
      const b = boxes[i];
      if (Math.abs(x - b.x) < b.half + plotRadius && Math.abs(z - b.z) < b.half + plotRadius) {
        return true;
      }
    }
    return false;
  };
}

export { round };
