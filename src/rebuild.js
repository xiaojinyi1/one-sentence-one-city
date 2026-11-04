// SECTION: rebuild
// 第 8 节：任何一次输入都走同一条链 —— 先清掉旧城，再按新 plan 重新 build。

import { buildCity, createCityKit, disposeCity } from './build.js';

export function createCityController(stage) {
  const kit = createCityKit();
  let current = null;
  let planRef = null;

  function clear() {
    if (!current) return;
    stage.scene.remove(current.group);
    disposeCity(current.group);
    current = null;
    planRef = null;
  }

  function apply(cityPlan) {
    clear();
    stage.applyLook(cityPlan);
    current = buildCity(cityPlan, kit);
    stage.scene.add(current.group);
    stage.setRadius(cityPlan.radius);
    planRef = cityPlan;
    return current;
  }

  return {
    kit,
    apply,
    clear,
    get city() {
      return current;
    },
    get plan() {
      return planRef;
    }
  };
}
