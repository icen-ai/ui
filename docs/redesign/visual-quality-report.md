# ICEN UI · 视觉质量报告

> 审查方式：在 1440×1000、`zh-CN`、reduced-motion 下渲染真实文档站（`site/dist`），逐页截图；对照 `macos-design-language.md` 的几何、层级、状态与材质规则。
> 截图基线：`.ui-audit/baseline/`（改动前），`.ui-audit/after1/`（首批控件改动后）。最终验收会把关键对比图收进 `docs/redesign/visuals/`。

---

## 1. 基线评分（改动前）

| 维度 | 评分 | 观察 |
|---|---|---|
| Native fidelity | 4/10 | 控件偏大、圆角偏大；select 无方向暗示；checkbox 无勾；菜单/行高偏松 |
| Geometry precision | 5/10 | 40px 控件 + 16px 容器角；文字/图标基本对齐，但内距与槽位缺乏统一阶梯 |
| Material authenticity | 5/10 | 模糊与阴影存在，但表面层级扁平；卡片、浮层、工具栏接近同一平面 |
| Interaction fidelity | 5/10 | focus/hover 有，pressed/selected 语法不统一；按钮 hover 抬阴影、按下缩放 |
| Theme consistency | 7/10 | 六主题色板完整；但选中色/边界色由组件各自推导 |
| Composition | 4/10 | 文档站是通用 Web 文档模板，组件组合缺少桌面应用工作区感 |
| Docs experience | 4/10 | 侧栏链接列表、白色预览卡、代码块与演示没有 Inspector/工作区关系 |

**关键截图（改动前）**

- 按钮：40px 高、间距松、primary hover 有抬升阴影、按下缩放。
- 输入：32/36/40 三档，但内距和 inset 阴影偏重，focus 外环与边框关系不够干净。
- 选择器：触发器无 chevron（behavior 主动 remove），只有“表面像控件”。
- 菜单/浮层：24px 模糊 + 10px 角 + 大 padding，行高接近移动端。
- 图表页：图表本体尚可，但轴标签/图例与页面排版不在同一密度。

---

## 2. 首批修正（after1）

| 问题 | 修改 | 结果 |
|---|---|---|
| 控件过大 | 34px 默认；28/42 两档；输入 9px 内距；按钮 12px 内距 | 控件与 13px 文字形成桌面比例；compact 28px |
| 圆角混乱 | 3/6/8/12/18 五档；按钮 6 / 菜单 12 / 卡片 8 | 控件与容器分层清楚 |
| 按钮“Web 模板感” | 顶部高光渐变 + 1px contact 影；hover 变深；active 内影；去除缩放 | 更像可按压的物理按钮，不再漂浮 |
| 输入 inset 过重 | `--icen-token-shadow-field` 单层 1px inset | 边框与焦点环更干净 |
| select 无方向暗示 | behavior 不再删除作者 chevron；12px、右内距 9px；清除钮出现时互斥 | 触发器恢复弹出语义 |
| 菜单行高偏松 | 12px 面板角、4px 内距、28px 行、13px 字 | 菜单密度接近桌面应用 |
| checkbox 方块 | 15px、勾选 mask、3px 角 | 选中语义一眼可读 |
| switch 偏 iOS | 38×22、18px thumb、accent-strong 开态、off fill-2 | 桌面比例与对比 |
| slider 轨道粗 | 4px 轨、18px 白 thumb + hairline、focus 1.08 | 更精确，不再像移动端 |
| 分段选中实心 | 白面 + hairline + contact 影；轨道 raised | 与桌面分段控件语义一致 |
| 日历格过大 | 30px 格、28px 导航、今天 accent 文字 | 密度与面板宽度协调 |
| tree-select 隐藏 chevron | 恢复 + 28px 行 + 菜单材质 | 与 select 同语法 |

**仍是问题（下一批）**

1. 文档站 shell 未改：侧栏、预览卡、代码区仍是 Web 文档模板。
2. 菜单/浮层打开态尚未截图验证（需要交互截图脚本）。
3. 表单族剩余组件（upload / tag-input / mentions / autocomplete / cascader）未统一几何。
4. 表格 / 侧栏 / 工具栏仍是旧密度。
5. AI / KB / 图表族仅继承 token，未做组件级审查。
6. 暗色下的顶部高光与 selected 底需要逐主题复核。
7. 13px 字号在部分演示里偏小，需检查行高与可读性。

---

## 3. 逐主题风险

| 主题 | 风险 | 检查点 |
|---|---|---|
| modern | 冷蓝 accent 与中性表面关系 | primary/selected/focus 在亮暗中对比 |
| dongyun | 暖白表面 + 青瓷 accent；阴影强度低 | 边界是否够清楚；selected 是否过淡 |
| jugou | 高 edge strength、实色材料 | 12px 圆角是否削弱体块；阴影是否仍成立 |
| piano | 高光强、深色反差大 | 顶部高光是否过亮；按钮渐变是否塑料 |
| monet | 低阴影、柔光 | 浮层是否浮不起来；need blur/opacity 组合 |
| vangogh | 高饱和黄蓝、亮色深字 | primary 文本对比；selected 底色是否污染画面 |

---

## 4. 下一轮审查清单

- [ ] 菜单/选择器打开态：选项 28px、选中勾选、搜索框 sticky、焦点环。
- [ ] 表格：30px 行、表头 11px、选中行、排序箭头、sticky 头。
- [ ] 侧栏：28px 行、分组标题、选中底、图标对齐。
- [ ] 工具栏：44px 高、28px 按钮、搜索/分段同排。
- [ ] 弹窗：标题/正文/按钮行距、焦点陷阱、scrim。
- [ ] 深色 + 六主题：按钮、菜单、选中行、focus ring。
- [ ] 密度 compact / comfortable：控件、表格、菜单不破。
- [ ] RTL：select chevron、menu icon、tree 缩进、toast 方向。
- [ ] 文档站：原生 shell 与组件工作区（Phase F8）。
