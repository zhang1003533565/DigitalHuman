# Mark 中文模型动作命名对照

这个文件用于维护 `mark_free_zh` 的动作命名，并和前端按钮、模型 JSON 中的动作顺序保持一致。

## 规则

- `Idle` 组只有 1 个待机动作，对应 `index: 0`
- `Tap` 组按 `mark_free_t04.model3.json` 中顺序，对应 `index: 0` 到 `index: 2`
- `FlickDown`、`FlickUp` 组各有 1 个动作，对应 `index: 0`
- 前端按钮名称定义在：
  `/frontend-visitor/src/digitalHuman/shared.ts`
- 模型动作文件顺序定义在：
  `/frontend-visitor/public/live2d/mark_free_zh/mark_free_t04.model3.json`

## 动作对照表

| 按钮名称 | 组名 | 索引 | 动作文件 |
| --- | --- | ---: | --- |
| 待机 | `Idle` | 0 | `motion/mark_m01.motion3.json` |
| 点击 01 | `Tap` | 0 | `motion/mark_m03.motion3.json` |
| 点击 02 | `Tap` | 1 | `motion/mark_m04.motion3.json` |
| 点击 03 | `Tap` | 2 | `motion/mark_m06.motion3.json` |
| 下滑 | `FlickDown` | 0 | `motion/mark_m02.motion3.json` |
| 上滑 | `FlickUp` | 0 | `motion/mark_m05.motion3.json` |
