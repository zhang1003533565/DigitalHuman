# Kei 中文口型模型动作命名对照

这个文件用于维护 `kei_vowels_pro` 的动作命名，并和前端按钮、模型 JSON 中的动作顺序保持一致。

## 规则

- 该模型动作组名为空字符串 `""`，按 `kei_vowels_pro.model3.json` 中顺序，对应 `index: 0` 到 `index: 3`
- 这些动作主要用于口型驱动预置（不同语种素材）
- 前端按钮名称定义在：
  `/frontend-visitor/src/digitalHuman/shared.ts`
- 模型动作文件顺序定义在：
  `/frontend-visitor/public/live2d/kei_vowels_pro/kei_vowels_pro.model3.json`

## 动作对照表

| 按钮名称 | 组名 | 索引 | 动作文件 |
| --- | --- | ---: | --- |
| 英文口型动作 | `""` | 0 | `motions/01_kei_en.motion3.json` |
| 日文口型动作 | `""` | 1 | `motions/01_kei_jp.motion3.json` |
| 韩文口型动作 | `""` | 2 | `motions/01_kei_ko.motion3.json` |
| 中文口型动作 | `""` | 3 | `motions/01_kei_zh.motion3.json` |
