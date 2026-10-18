# AI 输入体验：先看见意图，再决定动作

本轮落地到 `ai-composer`，延续本真和像素两套原语、六套配色。它是一组可组合的输入能力，不绑定某个模型、框架、上传服务或工具执行器。

## 三层信息

1. **正在写的内容**：一个连续的原生 textarea。选择资源、切模型、删除附件不会重建编辑器；保留输入法、浏览器选择与编辑能力。输入面保持实色，浮层负责层级。
2. **这次请求的上下文**：技能、工具、文件、文档和代理使用“图标块 + 名称 + 可移除操作”。目录中的说明占独立次行，长名称省略但保留完整 title；附件还有体积。选中以轻填充与内描边呈现，不使用勾号或“已选”文字。
3. **浏览与操作**：`＋` 提供可发现的分类目录；`@` 为引用的快捷入口；`/` 为执行命令的快捷入口。目录可多选上下文，命令先填入草稿并保留原任务，避免浏览时意外执行。`/` 的既有直接执行行为继续兼容。

技能与工具的“选入”只表示这次消息携带的意图。真正加载技能、开放工具、获取授权和执行工具由宿主决定。组件不把视觉选中当成权限授予。

## 接入与兼容

```ts
import {
  initAiComposer, setComposerRefs, setComposerCommands,
  openComposerLibrary, getComposerDraft, bindComposer,
} from '@icen.ai/ui/kit/ai-composer';

const destroy = initAiComposer(composer);
setComposerRefs(composer, [
  {kind:'skill', id:'design', label:'界面设计', description:'排版、材料与交互打磨', keywords:['design']},
  {kind:'tool', id:'search', label:'工作区搜索', icon:'search', description:'定位项目文件'},
  {kind:'file', id:'main', label:'src/main.ts', sub:'工作区'},
  {kind:'tool', id:'github', label:'GitHub', description:'连接后可用', disabled:true},
]);
setComposerCommands(composer, [
  {name:'review', label:'审查实现', group:'工作流', icon:'eye', description:'查找缺陷', argsHint:'[路径]'},
]);
// 可选：侧栏等窄空间使用 compact；不需要手写另一套组件。
composer.dataset.icenComposerSize = 'compact';
openComposerLibrary(composer, 'skill');
const draft = getComposerDraft(composer);
```

- 旧 `setComposerRefs` / `setComposerCommands` 参数与事件仍可用。新增字段全部可选。类别仍允许 `registerRefKind` 扩展；资源身份为 `(kind, id)`。
- 配置资源或命令后自动补充 `＋`；未配置时保留轻量输入。旧 actions DOM 的既有按钮被移动而非重建，监听仍有效。
- `icon` 接受共享 `IconName`，也支持通过 `registerIcon` 注册的名称；既有注册类别的 SVG 和 provider SVG 继续支持。
- `data-icen-panel-*` 与绑定的 `popoverSizing` 同时作用于模型、命令、引用及目录弹层，仍由共享 popover 限制视口边界。浮层按实际高度定位并观察面板/锚点尺寸，关闭时回收；目录锚定整个输入台，不覆盖草稿。测量保留内部滚动位置，内部滚动不触发自身重定位。

## 一条请求是一份独立快照

`icen:ai-send` / `icen:ai-queue` 为 `{text, refs?, files?}`，无上下文时仍严格为 `{text}`。发送或入队后清空当前附件、引用；后续草稿独立。空输入按 ↑ 取回待发消息时恢复该请求的文件与资源。停止或失败暂停队列，成功后才继续。

附件按钮、文件粘贴、文件拖放都写入同一真实状态。移除后派 `icen:ai-attachment-remove {file, files}`，不再只是删除视觉 chip；`getComposerDraft` 可读当前快照。文件由宿主上传，不猜地址或 provider 文件格式。

```ts
const binding = bindComposer(composer, {
  client, messages,
  usage: {from:'context'},
  async prepareMessage(draft, {signal}) {
    // upload / resolveReferences 为应用自己的适配器；返回 provider-neutral AiContent。
    const parts = await uploadAndResolve(draft, {signal});
    return parts;
  },
});
// binding.retry() 就地重试最后一次失败/停止的响应，保留下一条草稿。
// binding.unbind() 中止流与准备过程；迟到结果不会影响新会话。
```

没有 `prepareMessage` 时纯文本维持原行为，引用以消息文本/资源名称提供基本意图；附件会显示可重试的接入错误，避免无声丢失。准备过程失败也可重试；上传适配器应支持 signal，并自行处理重复上传。多模态能力仍由 provider 决定。

托管 client 的用量环只消费自己请求的完成结果，独立输入台互不串用量。纯事件绑定默认监听 document 保持兼容；多会话应用传 `eventTarget` 限定各自的完成事件。

## 键盘与视觉约束

- 搜索和文本编辑保留 DOM 焦点，`aria-activedescendant` 描述实际活动行。方向键浏览并跳过不可用项，Enter 确认，Escape 返回入口。
- 搜索文本安全地生成 `mark`，不解释 HTML。Home/End 保留光标移动；Ctrl/Meta + Home/End 可跳至首尾选项。
- 输入法组合期间不打开候选层、不发送，组合完成后再探测。
- 目录类别按钮正常进入 Tab 顺序；搜索 Tab 不意外确认选项。`/` 和 `@` 的旧 Tab 补全兼容。
- 触屏目标至少 44px，输入至少 16px；RTL 使用逻辑布局；强制颜色下选中与焦点有轮廓；减少动态时取消进场与边框过渡。
- 原语决定几何和字体，主题决定颜色。共享默认符号为 20×20 / 1.6 stroke；AI 工具卡的内置 kind 与消息操作沿用同一图标源。

可读性与不丢工作比持续动画更值得重复使用。设计参考 [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 的层级分工，并按 [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) 校核焦点和编辑键。测试通过只证明记录的行为范围，不能据此声称优于所有业界产品；屏幕阅读器实机、真实模型与上传后端的端到端验收仍须由具体产品补足。
