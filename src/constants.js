// SECTION: ui
// 第 3 节 固定内容（逐字使用，不得替换或改写）
export const SITE = {
  author: '你的名字',
  defaultText: '这座城市很大，夜里灯火很暖。'
};

// 第 3 节 EXAMPLES（顺序、label、text 均逐字使用）
export const EXAMPLES = [
  { label: '一个字', text: '海' },
  { label: '重复四次', text: '回家回家回家回家' },
  { label: '今天很不爽', text: '我恨上班！！！' },
  { label: '中英混排', text: '上线 v2.3，日志 https://api.example.com 有 1024 条。' }
];

// 第 14 节 文案（逐字使用；本轮只上屏其中一部分，其余原样保留供后续使用）
export const UI_COPY = {
  title: '一句话，一座城',
  subtitle: '打一句话，看它长成一座城',
  placeholder: '打点什么……',
  generating: '城正在升起',
  empty: '空白的地上什么也不会有',
  tooLong: '太长了，这座城建不完（超过 200 字按前 200 字生成）',
  shareCopied: '链接已复制，别人打开会看到同一座城',
  privacy: '所有计算都在你的浏览器里完成，句子不上传。',
  aboutTitle: '这座城是怎么长出来的',
  aboutBody:
    '句子长度决定城的大小，词频决定楼高，标点决定广场和针，\n' +
    '前半句住人、后半句经商，末位的词成为地标；\n' +
    '数字和网址在城南建起码头，情绪决定天色。同一句话永远生成同一座城。',
  keyHints: 'Enter 生成 · / 输入 · R 换示例 · F 线框 · D 读数'
};

// 第 14 节 tooLong 的截断长度
export const MAX_TEXT = 200;

// 第 18 节 P4：城市墙的 12 句预置文本。
// 前四条就是第 3 节的 EXAMPLES，原文不动；其余八句只从词表里取词，
// 覆盖单字 / 重复 / 纯负面 / 纯正面 / 中英数混合 / 长句 / 标点密集。
export const WALL_SENTENCES = [
  '海',
  '回家回家回家回家',
  '我恨上班！！！',
  '上线 v2.3，日志 https://api.example.com 有 1024 条。',
  '灯光温暖，梦里回家。',
  '加班，报错，崩溃，卡死，内耗，失眠。',
  '灯光？街道？车站？',
  '城市的夜晚很安静，灯光落在街道上，朋友从车站走回家，明天还要去上班。',
  '今天上线 v2.3 的服务器日志有 1024 条报错。',
  '春天，花开，海边，公园，广场。',
  '他说「港口」，又说「记忆」，还说「遗忘」。',
  '梦。'
];

// 第 7.4 节 尺寸单位常量表：调尺度只改这张表，不许在代码里散落魔法数字
export const UNITS = {
  // 尺度（R1）
  radiusBase: 8,
  radiusPerToken: 0.6,
  radiusMin: 8,
  radiusMax: 26,
  plotAreaFill: 0.92,

  // 高度（R2）
  // 本轮视觉：freq1 一律 1 层平房（原来 1~2 层），让「多数低矮」这个信息更硬；
  // freq≥3 的塔群拔到 12~26 层，和 1 层平房拉开体量反差。
  storyHeight: 0.55,
  floorsFreq1: [1, 1],
  floorsFreq2: [3, 6],
  floorsFreq3: [12, 26],
  // 本轮视觉：地标 ×2.6（原来 ×1.8），让「唯一地标」一眼认得出
  landmarkScale: 2.6,
  landmarkFootprint: 1.15,
  beamHeightScale: 2.6,
  beamRadiusTop: 0.05,
  beamRadiusBottom: 0.18,

  // 标点（R3）
  plazaRadius: 1.7,
  fountainRadius: 0.5,
  fountainHeight: 0.55,
  roadGapWidth: 1.5,
  crosswalkStripes: 5,
  needleHeight: 14,
  needleSection: 0.9,
  needleRadius: 0.45,
  twistFloorRad: 0.38,
  towerFootprint: 1.5,
  towerFloorsBase: 10,
  towerFloorsStep: 2,
  wallHeight: 1.5,
  wallThickness: 0.26,
  wallSizeRatio: 0.22,
  plazaCap: 6,
  gapCap: 4,
  twistCap: 5,
  needleCap: 12,
  wallCap: 2,

  // 排序分区（R4）
  avenueHalf: 1.6,
  avenueWidthRatio: 0.14,

  // 性格（R5）
  roofFlatWeight: 0.5,
  roofPitchWeight: 0.3,
  roofTankWeight: 0.2,
  hueSpreadDeg: 8,
  pitchRoofHeight: 0.62,
  antennaHeight: 0.7,
  antennaWidth: 0.06,
  waterTankRadius: 0.28,
  waterTankHeight: 0.34,

  // 情绪（R6）
  duskThreshold: 2,
  nightThreshold: -2,

  // 港区（R7）
  portOffset: 0.52,
  portGap: 0.1,
  tankRadius: 1.05,
  tankHeight: 2.2,
  chimneyRadius: 0.22,
  chimneyHeight: 4.8,
  tankCap: 8,
  containerCap: 48,
  containerW: 2.3,
  containerH: 1.05,
  containerD: 1.05,
  containerStack: 3,
  containerPerRun: 8,

  // 形态（R8）
  plotMin: 0.9,
  plotMax: 2.6,
  plotGap: 0.42,
  buildingFill: 0.78,
  floorScaleNarrow: 1.35,
  floorScaleWide: 0.62,

  // 第二轮：升起动画 / 接触阴影 / 浮尘 / 雨夜湿地 / 霓虹
  riseMin: 0.5,
  riseMax: 0.7,
  riseStaggerMin: 0.008,
  riseStaggerMax: 0.02,
  contactShadowOpacity: 0.35,
  contactShadowScale: 1.55,
  dustSize: 0.075,
  dustOpacity: 0.4,
  dustHeight: 4.4,
  dustSpread: 0.92,
  wetRoughness: 0.24,
  wetMetalness: 0.26,
  neonNight: 0.9,
  neonDusk: 0.34,
  neonMorning: 0.06,
  shadowSpanScale: 1.15,
  landmarkLightRange: 2.8,
  debugPlaneLift: 0.08,

  // 本轮视觉：地块网格不再像一张棋盘 —— 每块地自己转一点、挪一点
  plotFootprintMin: 1.1,
  plotFootprintMax: 1.9,
  plotRotJitterDeg: 8,
  plotPosJitter: 0.22,
  // 本轮视觉：随机留白 6~10% 的地块作为空地（空地只给接触阴影）
  emptyPlotMin: 0.06,
  emptyPlotMax: 0.1,
  // 本轮视觉：三档亮灯率（窗格按「层×列」哈希决定点哪一格）
  windowLitMorning: 0.15,
  windowLitDusk: 0.3,
  windowLitNight: 0.52,
  // 本轮视觉：纵深 —— 0.75R 以外的楼按 seed 固定地褪色、压暗
  depthStart: 0.75,
  depthDesat: 0.55,
  depthDarken: 0.24,

  // 预算与渲染
  instanceCap: 3000,
  dustMax: 200,
  cameraFov: 45,
  cameraDist: 0.95,
  cameraHeight: 0.32,
  cameraTarget: 0.9,
  // 本轮视觉：地标最高能到几十个单位，镜头跟着退一点留出天空，
  // 但只退一半 —— 全靠地标构图会让整座城被压成一条线。
  cameraFit: 0.5,
  minPolar: 0.15 * Math.PI,
  maxPolar: 0.48 * Math.PI,
  autoRotateDelay: 6000,
  autoRotateSpeed: 0.2,
  // 第 9 节：极角限制 [0.15π, 0.48π] —— 不许看到天空正上方，也不许贴地
  minPolarAngle: Math.PI * 0.15,
  maxPolarAngle: Math.PI * 0.48,
  shadowDesktop: 2048,
  shadowMobile: 1024,
  maxPixelRatio: 2,
  maxPixelRatioMobile: 1.5,
  shadowBias: -0.0004,
  lightIntensity: 1.1,
  ambientIntensity: 0.28,
  // three 0.160 默认物理正确光强：点光按 candela 计，irradiance = intensity / d²，
  // 所以这盏地标补光的数值要比直觉大一档（26 基本看不见，60 才在地标脚下压出暖色）。
  landmarkLightIntensity: 20,
  // 地面一直画到 radius * groundScale，雾在 groundScale 之前就把地面吃掉：
  // 两者对齐，地面平面的外沿就不会在地平线上留一条硬边。
  // 本轮视觉：near/far 收近，最远一排楼明显变淡（原来 0.95 / 2.2 太远）。
  fogNearScale: 0.85,
  fogFarScale: 2.4,
  skyRadiusScale: 3.0,
  groundScale: 2.2,
  // 地面 tint 往白色抬多少：抬得多地面就发白，清晨档全靠它压住
  groundTintLerp: 0.3,
  groundTextureSize: 1024,

  // 第 18 节 P1：双城对比
  // 两城之间的空隙 = max(dualGapMin, 较大半径 * dualGapRatio)；
  // 各自沿 X 偏移 ±(radius + gap/2)，两城的内边缘正好隔开 gap。
  dualGapMin: 2.4,
  dualGapRatio: 0.22,
  // 对比机位：把两城的半宽 span 塞进水平视锥，再留一点白
  dualCameraMargin: 0.82,
  dualCameraHeight: 0.42,
  // 天空左右两档的过渡带（按视线方向的 x 归一化，0 → 左城天空，1 → 右城天空）
  dualSeam: 6,
  // 双城视图里两块地面都缩一点，避免大范围重叠打架
  dualGroundScale: 0.66,
  // 浮尘只属于单城视图：双城里省掉这一份 drawcall
  dualSkipDust: true,
  // 双城时给另一座城补一盏不投影的色温灯（DirectionalLight 仍只有一盏）
  dualFillIntensity: 0.38,
  // 双城时相机退到约 1.8 倍半宽处，雾也要按半宽往外推，否则两城一起糊掉
  dualFogNear: 1.5,
  dualFogFar: 3.3,

  // 第 18 节 P4：城市墙（逐城离屏渲染成小图再拼网格）
  wallWidth: 512,
  wallHeight: 320,
  wallColumns: 4,
  wallPolar: Math.PI * 0.42,
  wallCameraMargin: 0.82,
  wallPressDepth: 0.62
};

// 第 10 节 调色：默认黄昏金 #e8b04b 系；整页 UI 深色
export const PALETTE = {
  ui: { bg: '#0c0d11', text: '#f6f3ea', dim: '#9a968c' },
  accent: '#e8b04b',
  ground: '#31353e',
  groundDeep: '#262a32',
  road: '#3a3e48',
  roadWear: 'rgba(255, 236, 200, 0.05)',
  plazaStone: '#5b544a',
  residential: {
    wall: '#cdbca4',
    window: '#ffd9a0',
    darkWindow: '#4a4338',
    hue: 32,
    roughness: 0.78,
    metalness: 0.04
  },
  commercial: {
    wall: '#3b4450',
    window: '#9fd8ff',
    darkWindow: '#20262e',
    neon: '#ff5fa2',
    hue: 205,
    roughness: 0.46,
    metalness: 0.24
  },
  metal: '#8f959d',
  container: ['#c8553d', '#3f7d8c', '#d9a441', '#5e6b7a', '#a0522d', '#7a8c6a'],
  sky: {
    // 本轮视觉：天空改成三段渐变（地平线 → 中段 → 顶部），并给地平线一条雾线。
    // mid 的取值让 y=0.5 处与原来的两段渐变基本重合，黄昏/雨夜不会走样。
    dusk: {
      top: '#231a3d',
      mid: '#523943',
      bottom: '#f0a25a',
      fog: '#7d6066',
      haze: '#d99a70',
      sun: '#ffd9a0',
      sunScale: 1,
      ambient: '#4b4356',
      ambientLevel: 0.28,
      hemiLevel: 0.9,
      shadowRadius: 3,
      ground: '#3a2f3f'
    },
    night: {
      top: '#050a16',
      mid: '#0a1021',
      bottom: '#1b2545',
      fog: '#111a2e',
      haze: '#2a3a5e',
      sun: '#6f8dff',
      sunScale: 0.6,
      ambient: '#1c2436',
      ambientLevel: 0.28,
      hemiLevel: 0.9,
      shadowRadius: 3,
      ground: '#10151f'
    },
    // 本轮视觉：清晨从「灰白平光」改成「柔和晨光」—— 顶部冷、中段灰白、地平线暖
    morning: {
      top: '#a8bcd4',
      mid: '#dfe3e6',
      bottom: '#f3e0c2',
      fog: '#a99f8d',
      haze: '#fbeed9',
      sun: '#fff2dc',
      sunScale: 0.8,
      ambient: '#9a958c',
      ambientLevel: 0.34,
      hemiLevel: 0.45,
      shadowRadius: 6,
      ground: '#544f42'
    }
  }
};

// 本轮视觉调整的前后对照，调试面板逐条打印。
// after 一律从 UNITS / PALETTE.sky 现取，不在这里另抄一份数字。
const percent = (value) => `${Math.round(value * 100)}%`;
export const VISUAL_DIFF = [
  { label: 'freq1 楼高', before: '1~2 层', after: `${UNITS.floorsFreq1[0]} 层平房` },
  { label: 'freq≥3 塔群', before: '8~20 层', after: `${UNITS.floorsFreq3[0]}~${UNITS.floorsFreq3[1]} 层` },
  { label: '地标倍数', before: '×1.8', after: `×${UNITS.landmarkScale}` },
  { label: '光柱', before: '三档都有', after: '仅黄昏 / 雨夜' },
  {
    label: '晨光天空',
    before: '两段 #aebccb / #ece7dc（中段缺失）',
    after: `${PALETTE.sky.morning.top} → ${PALETTE.sky.morning.mid} → ${PALETTE.sky.morning.bottom}`
  },
  {
    label: '晨光日光',
    before: '#fff3d6 ×1.10',
    after: `${PALETTE.sky.morning.sun} ×${(UNITS.lightIntensity * PALETTE.sky.morning.sunScale).toFixed(2)}`
  },
  { label: '晨光环境光', before: `${UNITS.ambientIntensity}`, after: `${PALETTE.sky.morning.ambientLevel}` },
  { label: '晨光阴影半径', before: 'PCFSoft 固定核', after: `PCF radius ${PALETTE.sky.morning.shadowRadius}` },
  {
    label: '亮灯率',
    before: '三档都是 100%',
    after: `晨 ${percent(UNITS.windowLitMorning)} / 昏 ${percent(UNITS.windowLitDusk)} / 夜 ${percent(UNITS.windowLitNight)}`
  },
  { label: '地块旋转', before: '0°', after: `±${UNITS.plotRotJitterDeg}°` },
  { label: '地块位移', before: '0', after: `±${UNITS.plotPosJitter}` },
  {
    label: '建筑宽度',
    before: `plot × ${UNITS.buildingFill}（定死）`,
    after: `${UNITS.plotFootprintMin}~${UNITS.plotFootprintMax}（按 plot 夹住）`
  },
  { label: '空地比例', before: '0', after: `${percent(UNITS.emptyPlotMin)}~${percent(UNITS.emptyPlotMax)}` },
  { label: '雾', before: '0.95R ~ 2.20R', after: `${UNITS.fogNearScale}R ~ ${UNITS.fogFarScale}R` },
  {
    label: '晨光雾色',
    before: '#cdd2d6（偏白，整屏发灰）',
    after: `${PALETTE.sky.morning.fog}（暖灰，地面沉得下去）`
  },
  {
    label: '半球光',
    before: '环境光 × 3.2（三档同一档）',
    after: `昏 ${PALETTE.sky.dusk.hemiLevel} / 夜 ${PALETTE.sky.night.hemiLevel} / 晨 ${PALETTE.sky.morning.hemiLevel}`
  },
  {
    label: '地面 tint 抬白',
    before: '0.5',
    after: `${UNITS.groundTintLerp}（越小白越少）`
  },
  {
    label: '针塔颜色',
    before: '#8f949c，雨夜像三根灰柱子',
    after: '#62676e（在夜色里退回去）'
  },
  {
    label: '相机',
    before: '只按半径 0.95R',
    after: `max(0.95R, 地标高 × ${UNITS.cameraFit})`
  },
  {
    label: '纵深',
    before: '无',
    after: `${UNITS.depthStart}R 外去饱和 ${percent(UNITS.depthDesat)}、压暗 ${percent(UNITS.depthDarken)}`
  }
];
