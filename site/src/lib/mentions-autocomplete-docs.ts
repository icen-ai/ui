/** Input suggestions: real typing, asynchronous loading, failure/retry and
 * route-owned disposers. Runtime callbacks are plain JavaScript strings. */
import type {ComponentDoc} from './components';
const ASYNC_DEMO=`const waitForDemo = (signal) => new Promise((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 600);
  if(signal.aborted) abort(); else signal.addEventListener('abort', abort, {once:true});
});
const events = new AbortController();
const show = (id, value) => { const target=document.getElementById(id);const text=document.createElement('bdi');text.textContent=value;target?.replaceChildren(text); };
const MEMBERS = [
  {id:'lin',label:'林晚晴',keywords:'lin 林',role:'设计师',email:'lin@team.example'},
  {id:'shen',label:'沈墨',keywords:'shen 沈',role:'编辑',email:'shen@team.example'},
  {id:'alice',label:'Alice',keywords:'ali alice',role:'开发者',email:'alice@team.example'},
  {id:'alina',label:'Alina',keywords:'ali alina',role:'设计师',email:'alina@team.example'},
  {id:'carol',label:'Carol',keywords:'carol',role:'暂不可选',disabled:true},
];
const matchMembers = (query) => MEMBERS.filter((item)=>(item.label+' '+item.keywords).toLowerCase().includes(query.toLowerCase()));
const memberRow = (item) => { const row=document.createElement('span');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;inline-size:100%;';const name=document.createElement('bdi');name.textContent=item.label;const detail=document.createElement('small');detail.textContent=MEMBERS.find((m)=>m.id === (item.id ?? item.value))?.role ?? '';detail.style.color='var(--icen-token-text-muted)';row.append(name,detail);return row; };
const describeMentions = (list) => list.map((m)=>'@'+m.label+'（'+m.kind+(m.item.role?(' · '+m.item.role):'')+(m.item.source?(' · '+m.item.source):'')+'）').join('、');
`;
export const MENTIONS_AUTOCOMPLETE_DOCS:ComponentDoc[]=[
  {
    slug:'mentions',name:'提及输入',group:'表单',
    summary:'提及是对象单元：像标签一样高亮、Backspace 整体删除，背后挂着完整的成员对象。',
    desc:'提及输入：@ 触发成员建议；提及渲染为原子 token（光标不可进入、整体删除），目录与自定义两种模式，数据是对象数组而非字符串猜测。',
    detail:{
      features:[
        '**对象单元**：提及渲染为 token pill（contenteditable=false），光标不会拆进内部，Backspace/Delete 整体删除',
        '**数据模型**：`getValue()` 返回 text/mention 内容块；目录成员与自定义对象的完整字段（email/role/source…）都保留在 `entity.item`',
        '**两种模式**：`mode:\'select\'` 只能选候选（默认）；`mode:\'custom\'` 可把当前 query 创建成虚线「自定义」token（`createCustom` 返回完整对象）',
        '**触发**：行首或空白后的 `@query` 打开建议；IME 组合输入不被打断；弹层关闭时 Enter 插入换行',
        '**键盘**：方向键跳过不可选成员，Enter 选中/创建，Escape 关闭当前建议',
        '**数据**：`source` 可异步（AbortSignal + 竞态守卫）；加载、失败与无匹配独立呈现，失败可原地重试',
        '**事件**：`icen:mention-select` `{ item, query }`；`icen:mention-change` `{ value, text, mentions }`；表单提交走同名 hidden input 的纯文本',
      ],
      notes:['`setValue()` 可直接喂 raw user/custom 对象（有 id 即渲染成原子提及）；`destroy()` 恢复原始 textarea 并回填当前纯文本。'],
    },
    demo:`<div class="demo-col" style="width:100%">
<label class="demo-label" for="mentions-text">参与讨论的成员（团队目录）</label>
<div class="icen-mentions" id="demo-mentions"><textarea id="mentions-text" class="icen-input" rows="3" placeholder="输入 @ 选择成员，也可以用姓名或拼音查找"></textarea></div>
<div class="demo-row"><button class="icen-btn icen-btn-sm" type="button" id="mentions-fail">模拟一次查询失败</button></div>
<p class="demo-label" id="mentions-log" role="status"><bdi>目录查询会稍作等待。可模拟失败，再在面板中重试。</bdi></p>
<label class="demo-label" for="mentions-custom-text">协作者（允许自定义提及）</label>
<div class="icen-mentions" id="demo-mentions-custom"><textarea id="mentions-custom-text" class="icen-input" rows="2" placeholder="输入 @林 选目录成员；输入不存在的名字可创建自定义提及"></textarea></div>
<p class="demo-label" id="mentions-custom-log" role="status"><bdi>自定义提及是虚线 token；Backspace 把它作为整体删除。</bdi></p>
</div>`,
    usage:`import {createMentions} from '@icen.ai/ui/kit/mentions';
// 声明式宿主不变：div.icen-mentions > textarea.icen-input，行为层换成富文本编辑区
const handle = createMentions(host, {
  source: async (query, {signal}) => {
    const response = await fetch('/api/members?q=' + encodeURIComponent(query), {signal});
    if(!response.ok) throw new Error('Member lookup failed');
    return response.json(); // 完整 user 对象：{ id, label?, name?, keywords?, disabled?, email?, role? }[]
  },
  trigger:'@', minChars:0, debounceMs:160, max:8,
  mode:'custom', // 'select'（默认）= 只能选候选；'custom' = 允许创建自定义提及
  createCustom: (query) => ({ id:'guest:'+query, label:query, source:'manual' }),
  loadingLabel:'正在查找成员…', errorLabel:'暂时无法查询成员，请重试。',
  noResultsLabel:'没有匹配的成员',
  // renderItem: (item, query) => Node | string, // 安全的展示槽位
  onSelect: (entity) => console.log(entity.kind, entity.item), // 完整 MentionEntity
  onChange: (value, text) => console.log(value, text),
});
// 提及是对象单元：Backspace/Delete 整体删除，光标不会进入 token 内部。
handle.getValue();    // [{type:'text',text}|{type:'mention',id,label,kind,item}][]
handle.getMentions(); // 仍存活的 MentionEntity[]（item 是完整源对象，非字符串猜测）
handle.getText();     // 纯文本（token 展开为 @名称；有 name 时随表单提交）
handle.setValue(['评审 ', {id:'u1', name:'林晚晴', email:'lin@team.example'}, '\\n请知悉']);
// 事件：icen:mention-select {item, query}；icen:mention-change {value, text, mentions}。
handle.close();   // 取消查询并关闭面板，不动正文
handle.destroy(); // 恢复原始 textarea，回填当前纯文本`,
    behaviors:['mentions'],
    script:ASYNC_DEMO+`let failNext=false;
const directory=mentionsMod.createMentions(document.getElementById('demo-mentions'),{
  source:async (query,{signal})=>{await waitForDemo(signal);if(failNext){failNext=false;throw new Error('Demo lookup failed');}return matchMembers(query);},
  loadingLabel:'正在查找成员…',errorLabel:'暂时无法查询成员，请重试。',noResultsLabel:'没有匹配的成员',renderItem:memberRow,
  onSelect:()=>{const list=directory.getMentions();show('mentions-log',list.length?('当前提及：'+describeMentions(list)):'还没有选择成员。');},
});
const field=document.getElementById('mentions-text');
field.addEventListener('icen:mention-change',()=>{const list=directory.getMentions();show('mentions-log',list.length?('当前提及：'+describeMentions(list)):'还没有选择成员。');},{signal:events.signal});
document.getElementById('mentions-fail').addEventListener('click',()=>{failNext=true;show('mentions-log','已开启一次失败演示；查找失败后，可以在面板中重试。');},{signal:events.signal});
const custom=mentionsMod.createMentions(document.getElementById('demo-mentions-custom'),{
  source:matchMembers,debounceMs:0,mode:'custom',renderItem:memberRow,
  createCustom:(query)=>({id:'guest:'+query,label:query,source:'手工录入'}),
  onSelect:(entity)=>show('mentions-custom-log','已创建 @'+entity.label+'（'+entity.kind+' · '+(entity.item.source??'')+'）自定义提及。'),
});
const customField=document.getElementById('mentions-custom-text');
customField.addEventListener('icen:mention-change',()=>{const list=custom.getMentions();show('mentions-custom-log',list.length?('当前提及：'+describeMentions(list)):'还没有提及任何人。');},{signal:events.signal});
return ()=>{events.abort();directory.destroy();custom.destroy();};`,
  },
  {
    slug:'autocomplete',name:'自动补全',group:'表单',
    summary:'输入几个字，找到需要的项目。建议跟随输入，关闭后不会被旧结果重新打扰。',
    desc:'自动补全：输入联想同步或异步建议，支持自由输入、自定义行与失败原地重试。',
    detail:{
      features:[
        '**数据**：`source` 同步或异步，返回 `string[]` 或 `{ value, label }[]`',
        '**呈现**：安全高亮、`renderItem` 自定义行；加载、无匹配与查询失败分开呈现',
        '**防护**：`AbortSignal` + 代际检查阻止旧结果；关闭 / 换词 / 失焦 / 销毁即中断',
        '**自由输入**：`freeSolo` 允许保留建议之外的值，离开时保留内容',
        '**语义**：`role=combobox` 控制真实 listbox，状态与重试按钮不混入 option',
        '**键盘**：Enter 确认（失败态重试），Tab 进重试按钮，Escape 取消并恢复上次选择',
      ],
      notes:['`getValue()` 返回选中 value，input 显示 label；`destroy()` 卸载后还原宿主字段。'],
    },
    demo:`<div class="demo-col" style="width:100%">
<label class="demo-label" for="demo-autocomplete-input">查找项目</label>
<div class="icen-input-wrap icen-control" style="width:100%"><input class="icen-input" id="demo-autocomplete-input" placeholder="输入现代、像素或海边" /></div>
<p class="demo-label" id="autocomplete-log" role="status"><bdi>方向键选择，Enter 确认；Escape 取消本次输入并恢复上次选择。</bdi></p>
<label class="demo-label" for="demo-autocomplete-async">查找负责人</label>
<div class="icen-input-wrap icen-control" style="width:100%"><input class="icen-input" id="demo-autocomplete-async" placeholder="输入林、沈或 ali，体验异步查找" /></div>
<div class="demo-row"><button class="icen-btn icen-btn-sm" type="button" id="autocomplete-fail">模拟一次查询失败</button></div>
<p class="demo-label" id="autocomplete-async-log" role="status"><bdi>查询失败时可以原地重试，不会把失败伪装成没有结果。</bdi></p>
<label class="demo-label" for="demo-autocomplete-free">自定义分类</label>
<div class="icen-input-wrap icen-control" style="width:100%"><input class="icen-input" id="demo-autocomplete-free" placeholder="选择建议，也可以保留自己的分类名" /></div>
<p class="demo-label" id="autocomplete-free-log" role="status"><bdi>这个字段允许自由输入，离开时保留内容。</bdi></p>
</div>`,
    usage:`import {createAutocomplete} from '@icen.ai/ui/kit/autocomplete';
const handle=createAutocomplete(input,{
  source:async (query,{signal})=>{
    const response=await fetch('/api/projects?q='+encodeURIComponent(query),{signal});
    if(!response.ok)throw new Error('Project lookup failed');
    return response.json(); // string[] 或 {value,label}[]
  },
  minChars:1,debounceMs:160,maxItems:8,freeSolo:false,
  loadingLabel:'正在查找项目…',errorLabel:'暂时无法查找项目，请重试。',
  noResultsLabel:'没有匹配的项目',
  // renderItem:(item,query)=>Node | string,
});
// role=combobox 控制真实 listbox；状态和重试动作不混入 option。
// Enter 在失败态重试；Tab 也可进入重试按钮，Escape 返回输入。
// source 失败会展示反馈；关闭/换词/失焦/销毁会 abort 在途请求。
input.addEventListener('icen:autocomplete-select',(event)=>console.log(event.detail));
handle.getValue(); // 选中 value；input 显示 label
handle.setValue('value');handle.open();handle.close();handle.destroy();`,
    behaviors:['autocomplete'],
    script:ASYNC_DEMO+`const input=document.getElementById('demo-autocomplete-input');
const PROJECTS=[{value:'modern',label:'现代设计系统'},{value:'pixel',label:'像素图标集'},{value:'sea',label:'海边的房间'},{value:'city',label:'城市漫游'},{value:'autumn',label:'秋日来信'},{value:'color',label:'色彩研究'}];
const basic=autocompleteMod.createAutocomplete(input,{source:(q)=>PROJECTS.filter((item)=>item.label.includes(q) || item.value.includes(q.toLowerCase())),debounceMs:0});
input.addEventListener('icen:autocomplete-select',(event)=>show('autocomplete-log','已选择：'+event.detail.label),{signal:events.signal});
let failNext=false;
const remote=autocompleteMod.createAutocomplete(document.getElementById('demo-autocomplete-async'),{
  source:async (query,{signal})=>{await waitForDemo(signal);if(failNext){failNext=false;throw new Error('Demo lookup failed');}return matchMembers(query).filter((item)=>!item.disabled).map((item)=>({value:item.id,label:item.label}));},
  loadingLabel:'正在查找成员…',errorLabel:'暂时无法查询成员，请重试。',noResultsLabel:'没有匹配的成员',renderItem:memberRow,
});
document.getElementById('demo-autocomplete-async').addEventListener('icen:autocomplete-select',(event)=>show('autocomplete-async-log','负责人：'+event.detail.label),{signal:events.signal});
document.getElementById('autocomplete-fail').addEventListener('click',()=>{failNext=true;show('autocomplete-async-log','已开启一次失败演示；查找失败后，可以在面板中重试。');},{signal:events.signal});
const freeInput=document.getElementById('demo-autocomplete-free');
const free=autocompleteMod.createAutocomplete(freeInput,{source:(q)=>['设计','开发','编辑','研究'].filter((value)=>value.includes(q)),freeSolo:true,debounceMs:0,noResultsLabel:'没有现成建议，可以保留自己的分类'});
freeInput.addEventListener('blur',()=>show('autocomplete-free-log',free.getValue() ? '当前分类：'+free.getValue() : '还没有设置分类。'),{signal:events.signal});
return ()=>{events.abort();basic.destroy();remote.destroy();free.destroy();};`,
  },
];
