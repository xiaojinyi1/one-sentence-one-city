# 一句话，一座城

打一句话，看它长成一座城。句子长度决定城的大小，词频决定楼高，标点决定广场和针，
顺序决定分区和地标，情绪决定天色。同一句话永远生成同一座城。

- 唯一运行时依赖：`three@0.160.0`（写死，见 `package.json`）
- 零外部资源：没有模型文件、没有图片、没有字体、没有联网 API、没有分词库
- 全程序化：立面、窗光、地面、天色都在浏览器里现算

## 运行

```bash
npm install
npm run dev      # 本地开发
npm run build    # 产出 dist/
npm run preview  # 预览构建结果
```

## 目录

```
index.html          页面骨架（只有 #app）
src/main.js         五段流程：tokenize → extract → plan → build → paint
src/constants.js    第 3 节固定内容、第 14 节文案、第 7.4 节 UNITS 常量表、调色板
src/wordlist.js     第 5 节种子词表与情绪极性表
src/tokenizer.js    分词：URL / ASCII / 数字 / 最长匹配 / 二字滑窗 / 单字 / emoji
src/sentiment.js    情绪打分
src/features.js     提取 TextFeatures（词频、平均词长、标点、情绪、哈希）
src/seed.js         FNV-1a + mulberry32
src/rules.js        第 4 节 R1–R8，只做「特征 → 参数」
src/layout.js       地块网格、分区、占位判定
src/plan.js         生成 CityPlan（可 JSON 化的纯数据）
src/build.js        CityPlan → InstancedMesh，只读 plan
src/materials.js    立面 canvas 贴图 + instanceColor + aGlow 自定义属性 + 三套天色的材质情绪
src/ground.js       地面 canvas 贴图（主干道、斑马线、广场、港区、接触阴影、雨夜水痕）
src/sky.js          按 R6 的三种天色做渐变天球
src/lights.js       灯光（日光 + 天空光 + 背光 + 阴影）
src/dust.js         浮尘粒子（≤200，随 seed 固定分布）
src/debugview.js    F 线框视图下的地块网格与分区标注
src/scene.js        渲染器 / 相机 / OrbitControls / 环境贴图（从天空球现做）
src/rebuild.js      输入变化时的清场、重建、错峰升起
src/ui.js           输入框、示例、状态、分享、导出、调试面板
src/selfcheck.js    第 5.5 节断言表（D 键打开调试面板）
src/fallback.js     WebGL 不可用时的说明页 + 映射规则表
selftest.mjs        命令行跑同一套断言，不需要浏览器（npm run selftest）
```

## 调试

- `D` 打开读数面板：5.5 断言逐条结果、命中明细（词 / 权重 / 累计）、补词数组、seed、半径、
  天色、形态、港区数量、规则触发与省略、drawcall
- `F` 线框视图：地块网格 + 分区色块 + 文字标注
- `/` 聚焦输入框，`R` 随机换一个示例，`Esc` 关掉说明
- 「保存图片」导出带句子角标的 PNG；「CityPlan JSON」导出可复现的纯数据
- 分享链接带 `?t=句子`，打开就是同一座城

## 第二轮范围

第 18 节「第二轮」把第一轮的方块城做成能看的一帧，仍然只有 `three` 一个依赖，
没有引入任何 glb / 贴图 / 字体 / 音频资源：

| 项 | 状态 |
| --- | --- |
| 窗光：instanceColor + `aGlow` 自定义 emissive 属性，不逐栋建材质（7.3） | 已完成 |
| 三套天色落到实际渲染：柔和晨光、黄昏金、雨夜蓝紫；雨夜湿反射 + 商业霓虹 | 已完成 |
| DirectionalLight 真阴影（桌面 2048 / 移动 1024，视锥收紧到城区）+ 环境光 + 地标补光 | 已完成 |
| 每栋楼底部径向渐变接触阴影（烘进地面贴图，不额外 drawcall） | 已完成 |
| 浮尘 ≤200，随 seed 固定分布，reduced-motion 时关闭 | 已完成 |
| 升起动画：单栋 0.5~0.7s，8~20ms 错峰，按距地标远近排序（参数在 UNITS） | 已完成 |
| `?t=` 可复现 + `preserveDrawingBuffer` + 带句子角标的 PNG 下载 + CityPlan JSON | 已完成 |
| D 读数面板 / F 线框地块视图 / 第 14 节文案 / reduced-motion / 移动端降级 | 已完成 |
| WebGL 不可用时的文字映射表说明页 | 已完成 |

## 第三轮范围（P1 双城对比 / P4 城市墙）

第 18 节第三轮只做两件事，两件都是「新增视图」，默认进入的仍然是主城视图：

| 项 | 状态 |
| --- | --- |
| P1 同一个 scene 里两个 Group，左右各一城，共用相机 / 灯光 / 天空 / 渲染管线（不新建 renderer 或 canvas） | 已完成 |
| P1 进入对比时相机沿 Z 后撤同时框住两城（FOV 不变），退出恢复原极角与原机位 | 已完成 |
| P1 两城各自取自己句子的天色：一颗天空网格按 x 做软过渡；投影光只有一盏，另一侧只加不投影补光 | 已完成 |
| P1 两个输入框（手机端纵向堆叠）各自 300ms debounce 实时重建 | 已完成 |
| P1 差异面板：词数 / 半径 / 平均词长 / 情绪得分 / 最高词 / 建筑实例 / 天色档位，全部取自各自 CityPlan | 已完成 |
| P1 两城各自独立的地标与光柱 | 已完成 |
| P1 `?t1=&t2=` 可同时复现两城（单句仍用 `?t=`） | 已完成 |
| P4 12 句预置文本，含四条 EXAMPLES 原文，覆盖单字 / 重复 / 纯负面 / 纯正面 / 中英数 / 长句 / 标点密集 | 已完成 |
| P4 复用同一个 renderer 逐座离屏渲染 512×320，渲完立刻 dispose 该城，内存不随座数持续上涨 | 已完成 |
| P4 俯视固定机位（极角 0.42π）、统一 16:10 网格，句子超出省略，颜色之外还有档位词 | 已完成 |
| P4 点任意一张回主视图用该句重建；「导出整墙长图」一次下载 12 格拼图 | 已完成 |

调试面板（`D`）在读数字段末尾追加了一整段「视觉参数 diff（本轮）」，逐条是
`改前 → 改后`，值是当场从 `UNITS` 与 `PALETTE.sky` 里读的，不是写死的字符串。

## 验证

```powershell
# 一步做完：装依赖、构建、提交、推送
.\setup-and-push.ps1 -Remote https://github.com/你的账号/one-sentence-one-city.git

# 或者只装依赖并构建
.\setup-and-push.ps1 -SkipPush
```

浏览器里按 `D`，调试面板第一块就是第 5.3 节自检：

- 词表 94 条全部能被分词命中
- 四条例句的颜色：`海` → 清晨，`回家 ×4` → 黄昏，`我恨上班！！！` → 雨夜，中英混排 → 清晨
- 同一句话连按两次 `D`，plan 的 JSON 完全一致

## 降级与已知取舍

- 5.2 极性表原表一字未改；计分口径按 5.4 加权（强正 +2 / 一般正 +1 / 强负 -2 / 一般负 -1），
  `POLARITY_SUPPLEMENT` 现在是空数组（5.4 的 P2 要求撤掉为「我恨上班！」补的 `上班`），
  调试面板里仍然显示它的内容与条数。
- 问号塔的扭转角度按塔不同，但共用一份扭转几何（一份几何一次 drawcall 的代价）。
- 坡屋顶用三棱柱近似，下半截埋进楼体，外观上是双坡。
- 屋顶水箱与天线挂在同一个圆柱实例组里，不额外增加 drawcall。
- P1 双城视图实测 drawcall 12（8 个本城实例组 + 另一座城的实例组 + 天空 / 地面 / 光柱），
  正好顶到第 7.2 节的上限；为此双城视图省掉浮尘与地块网格。
- P4 城市墙每座城渲完会释放几何与贴图，`renderer.info.memory.geometries` 稳定在 12；
  `textures` 在整批 12 座里净增约 1 张/座（离屏用的 canvas 贴图与 PMREM 目标），
  批次结束后不再增长，整批 JS 堆增量约 2MB（主要是 12 张缩略图本身）。
- 地标 = 最高频词层数 × 2.6，`回家×4` 会算出 56 层（≈30 单位高），相机因此按
  `max(0.95R, 地标高×0.5)` 退让，塔顶仍会出画；这是「体量反差」的代价，规则没有改。

