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
src/materials.js    立面 canvas 贴图 + instanceColor + aGlow 自定义属性
src/ground.js       地面 canvas 贴图（主干道、斑马线、广场、港区）
src/sky.js          按 R6 的三种天色做渐变天球
src/lights.js       基础灯光（日光 + 天空光 + 背光）
src/scene.js        渲染器 / 相机 / OrbitControls
src/rebuild.js      输入变化时的清场与重建
src/ui.js           输入框、示例、状态、分享、调试面板
src/selfcheck.js    第 5.3 节覆盖自检（D 键打开调试面板）
src/fallback.js     WebGL 不可用时的说明页 + 映射规则表
```

## 调试

- `D` 打开调试面板：第 5.3 节自检结果、seed、半径、天色、楼数、港区数量、drawcall
- `F` 线框
- `/` 聚焦输入框
- `R` 随机换一个示例
- 分享链接带 `?t=句子`，打开就是同一座城

## 第一轮范围

第 18 节「第一轮」只做地基，不做第二轮（无分享卡片、无雨、无鸟、无音效）：

| 项 | 状态 |
| --- | --- |
| tokenizer（URL / ASCII / 数字 / 最长匹配 / 二字滑窗 / 单字 / emoji） | 已完成 |
| 第 5 节词表 94 条 + 极性表 + 5.3 覆盖自检 | 已完成，自检 16 项 |
| 特征提取（词频、平均词长、标点、情绪、哈希） | 已完成 |
| FNV-1a + mulberry32 种子 | 已完成 |
| R1–R8 全部映射规则 | 已完成 |
| `plan()` / `build()` 分离（CityPlan 可 JSON 化） | 已完成 |
| InstancedMesh 建筑、五组几何、总 drawcall 12 | 已完成 |
| 基础灯光、天空、地面、OrbitControls | 已完成 |
| 输入即重建（300ms debounce）+ 冷启动 | 已完成 |
| WebGL 不可用时的说明页 + 映射表 | 已完成 |

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

- 5.2 极性表原表一字未改；只在 `POLARITY_SUPPLEMENT` 里补了一个负面词 `上班`
  （依据 PROMOTE.md 第 80–81 行「补词表或改规则分支，禁止改句子文案」），
  因为示例「我恨上班！！！」的 label 是「今天很不爽」。补词条数在调试面板里单独报告，
  删掉那一行就回到「-1 分 → 清晨」。
- 问号塔的扭转角度按塔不同，但共用一份扭转几何（一份几何一次 drawcall 的代价）。
- 坡屋顶用三棱柱近似，下半截埋进楼体，外观上是双坡。
- 屋顶水箱与天线挂在同一个圆柱实例组里，不额外增加 drawcall。
