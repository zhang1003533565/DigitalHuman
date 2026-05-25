# 春迎面者动作命名对照

这个文件用于维护 `haru_greeter_pro_jp` 的动作命名，并和前端按钮、模型 JSON 中的动作顺序保持一致。

## 规则

- `Idle` 组只有 1 个待机动作，对应按钮 `待机 Idle`
- `Action` 组按 `haru_greeter_t05.model3.json` 中的顺序，从 `index: 0` 到 `index: 25`
- 前端按钮名称定义在：
  `/frontend-visitor/src/digitalHuman/shared.ts`
- 模型动作文件顺序定义在：
  `/frontend-visitor/public/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json`

## 动作对照表

| 按钮名称 | 组名 | 索引 | 动作文件 |
| --- | --- | ---: | --- |
| 待机 Idle | `Idle` | 0 | `motion/haru_g_idle.motion3.json` |
| M01 待机点头 | `Action` | 0 | `motion/haru_g_m01.motion3.json` |
| M02 背手点头 | `Action` | 1 | `motion/haru_g_m02.motion3.json` |
| M03 抱臂无奈点头 | `Action` | 2 | `motion/haru_g_m03.motion3.json` |
| M04 哦，抱臂点头 | `Action` | 3 | `motion/haru_g_m04.motion3.json` |
| M05 惊讶点头 | `Action` | 4 | `motion/haru_g_m05.motion3.json` |
| M06 微笑左摆手 | `Action` | 5 | `motion/haru_g_m06.motion3.json` |
| M07 微笑右摆手 | `Action` | 6 | `motion/haru_g_m07.motion3.json` |
| M08 给摸头 | `Action` | 7 | `motion/haru_g_m08.motion3.json` |
| M09 前倾点头 / 鞠躬 | `Action` | 8 | `motion/haru_g_m09.motion3.json` |
| M10 惊讶被摸头 | `Action` | 9 | `motion/haru_g_m10.motion3.json` |
| M11 抱臂摇头 | `Action` | 10 | `motion/haru_g_m11.motion3.json` |
| M12 摆手拒绝 | `Action` | 11 | `motion/haru_g_m12.motion3.json` |
| M13 惊讶疑问眨眼 | `Action` | 12 | `motion/haru_g_m13.motion3.json` |
| M14 惊讶疑问 | `Action` | 13 | `motion/haru_g_m14.motion3.json` |
| M15 微笑轻微摇头 | `Action` | 14 | `motion/haru_g_m15.motion3.json` |
| M16 抱歉 | `Action` | 15 | `motion/haru_g_m16.motion3.json` |
| M17 凑近害羞 | `Action` | 16 | `motion/haru_g_m17.motion3.json` |
| M18 害羞脸红 | `Action` | 17 | `motion/haru_g_m18.motion3.json` |
| M19 低头害羞 | `Action` | 18 | `motion/haru_g_m19.motion3.json` |
| M20 思考 | `Action` | 19 | `motion/haru_g_m20.motion3.json` |
| M21 开心地跳起来 | `Action` | 20 | `motion/haru_g_m21.motion3.json` |
| M22 害羞开心 | `Action` | 21 | `motion/haru_g_m22.motion3.json` |
| M23 开心合手 | `Action` | 22 | `motion/haru_g_m23.motion3.json` |
| M24 惊讶生气 | `Action` | 23 | `motion/haru_g_m24.motion3.json` |
| M25 惊讶转微笑 | `Action` | 24 | `motion/haru_g_m25.motion3.json` |
| M26 愣住转微笑 | `Action` | 25 | `motion/haru_g_m26.motion3.json` |

