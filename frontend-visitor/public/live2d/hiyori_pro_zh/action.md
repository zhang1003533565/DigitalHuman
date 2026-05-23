# Hiyori 中文模型动作命名对照

这个文件用于维护 `hiyori_pro_zh` 的动作命名，并和前端按钮、模型 JSON 中的动作顺序保持一致。

## 规则

- `Idle` 组按 `hiyori_pro_t11.model3.json` 中顺序，对应 `index: 0` 到 `index: 2`
- `Flick`、`FlickDown`、`FlickUp`、`Tap@Body`、`Flick@Body` 组各有 1 个动作，对应 `index: 0`
- `Tap` 组有 2 个动作，对应 `index: 0` 到 `index: 1`
- 前端按钮名称定义在：
  `/frontend-visitor/src/digitalHuman/shared.ts`
- 模型动作文件顺序定义在：
  `/frontend-visitor/public/live2d/hiyori_pro_zh/hiyori_pro_t11.model3.json`

## 动作对照表

| 按钮名称 | 组名 | 索引 | 动作文件 |
| --- | --- | ---: | --- |
| 待机 01 | `Idle` | 0 | `motion/hiyori_m01.motion3.json` |
| 待机 02 | `Idle` | 1 | `motion/hiyori_m02.motion3.json` |
| 待机 03 | `Idle` | 2 | `motion/hiyori_m05.motion3.json` |
| 轻扫 | `Flick` | 0 | `motion/hiyori_m03.motion3.json` |
| 下滑 | `FlickDown` | 0 | `motion/hiyori_m04.motion3.json` |
| 上滑 | `FlickUp` | 0 | `motion/hiyori_m06.motion3.json` |
| 点击 01 | `Tap` | 0 | `motion/hiyori_m07.motion3.json` |
| 点击 02 | `Tap` | 1 | `motion/hiyori_m08.motion3.json` |
| 身体点击 | `Tap@Body` | 0 | `motion/hiyori_m09.motion3.json` |
| 身体轻扫 | `Flick@Body` | 0 | `motion/hiyori_m10.motion3.json` |
