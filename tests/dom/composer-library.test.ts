import {afterEach,expect,test} from 'bun:test';
import {bindComposer,getComposerDraft,initAiComposer,openComposerLibrary,setComposerCommands,setComposerRefs,setComposerRunning} from '../../src/behaviors/ai-composer';
import type {AiComposerSubmission} from '../../src/behaviors/ai-composer';
import type {AiChatRequest,AiClient} from '../../src/behaviors/ai-provider';

const off:(()=>void)[]=[];
const tick=()=>new Promise(r=>setTimeout(r,0));
afterEach(()=>{off.splice(0).reverse().forEach(f=>f());document.body.replaceChildren()});
function fixture(){
  const el=document.createElement('div');el.className='icen-ai-composer';el.dataset.icenAiComposer='';
  el.innerHTML='<div class="icen-ai-composer-queue" hidden></div><div class="icen-ai-composer-box"><textarea class="icen-ai-composer-input"></textarea><div class="icen-ai-composer-toolbar"><button data-icen-ai-attach type="button"></button><button data-icen-ai-send type="button"></button></div></div>';
  document.body.append(el);off.push(initAiComposer(el));
  const ta=el.querySelector('textarea')!;
  const key=(key:string)=>ta.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  const paste=(files:File[])=>{const e=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{files}});ta.dispatchEvent(e)};
  return {el,ta,key,paste};
}
const skills=[{kind:'skill',id:'same',label:'界面设计',description:'层级与材料',keywords:['design']},{kind:'tool',id:'same',label:'搜索',description:'项目文件',disabled:false},{kind:'tool',id:'off',label:'GitHub',description:'等待连接',disabled:true}];
const option=(id:string)=>document.querySelector<HTMLButtonElement>(`.icen-ai-composer-popup-option[data-ref-id="${id}"]`)!;

test('legacy text submissions keep their exact payload; optional library does not replace the native editor',()=>{
  const {el,ta,key}=fixture();let payload:unknown;el.addEventListener('icen:ai-send',e=>payload=(e as CustomEvent).detail);
  ta.value='原生草稿';key('Enter');expect(payload).toEqual({text:'原生草稿'});
  setComposerRefs(el,skills);expect(el.querySelector('textarea')===ta).toBe(true);expect(el.querySelector('[data-icen-ai-library]')).not.toBeNull();
  setComposerRefs(el,[]);expect(el.querySelector('[data-icen-ai-library]')).toBeNull();
});

test('resource browsing toggles composite identities, retains the draft, skips unavailable items and stages commands',()=>{
  const {el,ta,key}=fixture();setComposerRefs(el,skills);setComposerCommands(el,[{name:'review',label:'审查实现',description:'核对代码'}]);ta.value='保留的任务';
  openComposerLibrary(el);option('same').click();
  document.querySelector<HTMLButtonElement>('[data-ref-kind="tool"][data-ref-id="same"]')!.click();
  option('off').click();expect(getComposerDraft(el).refs?.map(r=>r.kind)).toEqual(['skill','tool']);expect(ta.value).toBe('保留的任务');
  expect(option('same').getAttribute('aria-selected')).toBe('true');option('same').click();expect(getComposerDraft(el).refs?.map(r=>r.kind)).toEqual(['tool']);
  let commands=0;el.addEventListener('icen:ai-command',()=>commands++);
  document.querySelector<HTMLButtonElement>('[data-name="review"]')!.click();expect(ta.value).toBe('/review 保留的任务');expect(commands).toBe(0);expect(document.activeElement===ta).toBe(true);
  key('Enter');expect(commands).toBe(1);expect(ta.value).toBe('');
});

test('empty library searches never send the underlying draft or consume its context',()=>{
  const {el,ta}=fixture();setComposerRefs(el,skills);ta.value='尚未完成的任务';let sent=0;el.addEventListener('icen:ai-send',()=>sent++);openComposerLibrary(el);
  const search=document.querySelector<HTMLInputElement>('.icen-ai-composer-popup-search-input')!;search.value='没有这个结果';search.dispatchEvent(new Event('input'));
  search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));expect(sent).toBe(0);expect(ta.value).toBe('尚未完成的任务');expect(search.isConnected).toBe(true);
});

test('search highlights plain text and exposes the active option without interpreting markup',()=>{
  const {el,ta}=fixture();setComposerRefs(el,[{kind:'skill',id:'s',label:'<img src=x>设计'}]);openComposerLibrary(el);
  const input=document.querySelector<HTMLInputElement>('.icen-ai-composer-popup-search-input')!;input.value='<img';input.dispatchEvent(new Event('input'));
  expect(document.querySelector('.icen-ai-composer-popup-option mark')?.textContent).toBe('<img');expect(document.querySelector('img')).toBeNull();
  const id=input.getAttribute('aria-activedescendant');expect(!!id&&document.getElementById(id)?.getAttribute('role')==='option').toBe(true);
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(input.isConnected).toBe(false);expect(el.querySelector('[data-icen-ai-library]')?.getAttribute('aria-expanded')).toBe('false');expect(ta.value).toBe('');
});

test('files are actual draft state; removal emits the remaining set and restores focus',()=>{
  const {el,ta,paste}=fixture();const a=new File(['a'],'a.txt'),b=new File(['b'],'b.txt');paste([a,b]);paste([a]);expect(getComposerDraft(el).files).toHaveLength(2);
  let removed:File|undefined;el.addEventListener('icen:ai-attachment-remove',e=>removed=(e as CustomEvent).detail.file);
  const remove=el.querySelector<HTMLButtonElement>('.icen-ai-composer-chip-remove')!;remove.focus();remove.click();expect(removed===a).toBe(true);expect(getComposerDraft(el).files).toEqual([b]);
  expect(document.activeElement===el.querySelector('.icen-ai-composer-chip-remove')).toBe(true);
  el.querySelector<HTMLButtonElement>('.icen-ai-composer-chip-remove')!.click();expect(document.activeElement===ta).toBe(true);expect(el.querySelector('.icen-ai-composer-attach')?.hasAttribute('hidden')).toBe(true);
});

test('queued submissions snapshot files and references independently, and editing restores them',()=>{
  const {el,ta,key,paste}=fixture();setComposerRefs(el,skills);openComposerLibrary(el);option('same').click();document.querySelector<HTMLInputElement>('.icen-ai-composer-popup-search-input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  const file=new File(['现代'],'design.txt');paste([file]);let queued:AiComposerSubmission|undefined;el.addEventListener('icen:ai-queue',e=>queued=(e as CustomEvent).detail);
  setComposerRunning(el,true);ta.value='整理材料';key('Enter');expect(queued?.refs?.[0]?.kind).toBe('skill');expect(queued?.files?.[0]===file).toBe(true);expect(getComposerDraft(el)).toEqual({text:''});
  setComposerRunning(el,false);key('ArrowUp');expect(getComposerDraft(el).text).toBe('整理材料');expect(getComposerDraft(el).files?.[0]===file).toBe(true);expect(getComposerDraft(el).refs).toHaveLength(1);
});

test('IME composition suspends completion and disabled editors cannot submit',()=>{
  const {el,ta,key}=fixture();setComposerRefs(el,skills);ta.dispatchEvent(new CompositionEvent('compositionstart'));ta.value='@';ta.dispatchEvent(new Event('input'));key('Enter');expect(document.querySelector('.icen-ai-composer-popup')).toBeNull();expect(ta.value).toBe('@');
  ta.dispatchEvent(new CompositionEvent('compositionend'));expect(document.querySelector('.icen-ai-composer-popup')).not.toBeNull();
  ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ta.disabled=true;let sent=0;el.addEventListener('icen:ai-send',()=>sent++);key('Enter');expect(sent).toBe(0);
});

test('upload preparation is cancellable and a late resolution cannot start a request',async()=>{
  const {el,ta,key,paste}=fixture();const messages=document.createElement('div');document.body.append(messages);const requests:AiChatRequest[]=[];
  const client:AiClient={config:{provider:'test',baseURL:'',model:'test'},chat:async()=>({text:'',usage:{}}),stream:r=>{requests.push(r);throw new Error('should not start')}};
  let finish!:(text:string)=>void,signal:AbortSignal|undefined;
  const binding=bindComposer(el,{client,messages,prepareMessage:(_draft,ctx)=>{signal=ctx.signal;return new Promise(r=>finish=r)}});off.push(()=>binding.unbind());
  paste([new File(['a'],'a.txt')]);ta.value='分析';key('Enter');expect(el.classList.contains('is-running')).toBe(true);el.querySelector<HTMLButtonElement>('[data-icen-ai-send]')!.click();expect(signal?.aborted).toBe(true);
  finish('已经上传');await tick();expect(requests).toHaveLength(0);expect(el.classList.contains('is-running')).toBe(false);expect(binding.retry()).toBe(true);
});

test('missing upload adapters fail visibly instead of silently discarding selected files',async()=>{
  const {el,ta,key,paste}=fixture();const messages=document.createElement('div');document.body.append(messages);let requests=0;
  const client:AiClient={config:{provider:'test',baseURL:'',model:'test'},chat:async()=>({text:'',usage:{}}),stream:()=>{requests++;throw new Error('should not start')}};
  const binding=bindComposer(el,{client,messages});off.push(()=>binding.unbind());paste([new File(['a'],'a.txt')]);ta.value='分析';key('Enter');await tick();
  expect(requests).toBe(0);expect(messages.textContent).toContain('prepareMessage');expect(binding.retry()).toBe(true);
});

test('prepared content reaches the provider and independent composers do not share usage',async()=>{
  const a=fixture(),b=fixture();const messages=document.createElement('div');document.body.append(messages);const requests:AiChatRequest[]=[];
  const client:AiClient={config:{provider:'test',baseURL:'',model:'test'},chat:async()=>({text:'',usage:{}}),stream:req=>{requests.push(req);return {cancel(){},done:Promise.resolve({text:'完成',usage:{input:100,output:20,total:120}}),async *[Symbol.asyncIterator](){yield {type:'text' as const,delta:'完成'}}}}};
  const bindingA=bindComposer(a.el,{client,messages,usage:{from:'billing'},prepareMessage:draft=>[{type:'text',text:draft.text},{type:'file',url:'uploaded-file-id',filename:draft.files![0].name,mimeType:'text/plain'}]});
  const bindingB=bindComposer(b.el,{client,messages,usage:{from:'billing'}});off.push(()=>bindingA.unbind(),()=>bindingB.unbind());
  a.paste([new File(['材料'],'design.txt')]);a.ta.value='请读';a.key('Enter');await tick();
  expect(requests[0].messages[0].content).toEqual([{type:'text',text:'请读'},{type:'file',url:'uploaded-file-id',filename:'design.txt',mimeType:'text/plain'}]);
  expect(messages.querySelector('.icen-ai-msg-context')?.textContent).toContain('design.txt');
  expect(a.el.querySelector('.icen-ai-composer-usage')).not.toBeNull();expect(b.el.querySelector('.icen-ai-composer-usage')).toBeNull();
});
