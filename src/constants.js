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

// 第 7.4 节 尺寸单位常量表：调尺度只改这张表，不许在代码里散落魔法数字
export const UNITS = {
  // 尺度（R1）
  radiusBase: 8,
  radiusPerToken: 0.6,
  radiusMin: 8,
  radiusMax: 26,
  plotAreaFill: 0.92,

  // 高度（R2）
  storyHeight: 0.55,
  floorsFreq1: [1, 2],
  floorsFreq2: [3, 6],
  floorsFreq3: [8, 20],
  landmarkScale: 1.8,
  landmarkFootprint: 1.15,
  beamHeightScale: 4.2,
  beamRadiusTop: 0.06,
  beamRadiusBottom: 0.3,

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

  // 预算与渲染
  instanceCap: 3000,
  dustMax: 200,
  cameraFov: 45,
  cameraDist: 1.85,
  cameraHeight: 1.25,
  cameraTarget: 0.9,
  minPolar: 0.15 * Math.PI,
  maxPolar: 0.48 * Math.PI,
  autoRotateDelay: 6000,
  autoRotateSpeed: 0.2,
  shadowDesktop: 2048,
  shadowMobile: 1024,
  maxPixelRatio: 2,
  maxPixelRatioMobile: 1.5,
  shadowBias: -0.0004,
  lightIntensity: 1.1,
  ambientIntensity: 0.28,
  landmarkLightIntensity: 26,
  fogNearScale: 0.9,
  fogFarScale: 2.6,
  skyRadiusScale: 3.2,
  groundScale: 2.6,
  groundTextureSize: 1024
};

// 第 10 节 调色：默认黄昏金 #e8b04b 系；整页 UI 深色
export const PALETTE = {
  ui: { bg: '#0c0d11', text: '#f6f3ea', dim: '#9a968c' },
  accent: '#e8b04b',
  ground: '#12141a',
  groundDeep: '#0a0c11',
  road: '#24272f',
  roadWear: 'rgba(255, 236, 200, 0.05)',
  plazaStone: '#2f2c2a',
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
    dusk: {
      top: '#231a3d',
      bottom: '#f0a25a',
      fog: '#7d5b4b',
      sun: '#ffd9a0',
      ambient: '#4b4356',
      ground: '#3a2f3f'
    },
    night: {
      top: '#050a16',
      bottom: '#1b2545',
      fog: '#111a2e',
      sun: '#6f8dff',
      ambient: '#1c2436',
      ground: '#10151f'
    },
    morning: {
      top: '#aebccb',
      bottom: '#ece7dc',
      fog: '#cdd2d6',
      sun: '#fff3d6',
      ambient: '#8e97a3',
      ground: '#606a72'
    }
  }
};
