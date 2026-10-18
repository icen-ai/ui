import {afterEach,expect,test} from 'bun:test';
import {bindComposer,initAiComposer} from '../../src/behaviors/ai-composer';
import type {AiChatRequest,AiChatResult,AiClient,AiStreamChunk} from '../../src/behaviors/ai-provider';

const cleanups:(()=>void)[]=[];
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
afterEach(()=>{cleanups.splice(0).reverse().forEach(off=>off());document.body.replaceChildren();});
function session() {
  const chunks:AiStreamChunk[]=[];
  let ended=false, wake=()=>{}, resolve!:(r:AiChatResult)=>void;
  const done=new Promise<AiChatResult>(r=>resolve=r);
  let cancelled=0;
  const handle={done,cancel:()=>{cancelled++},async *[Symbol.asyncIterator](){
    while(!ended||chunks.length){if(chunks.length)yield chunks.shift()!;else await new Promise<void>(r=>wake=r);}
  }};
  return {handle,get cancelled(){return cancelled},push(chunk:AiStreamChunk){chunks.push(chunk);wake()},finish(text='回答'){ended=true;resolve({text,usage:{total:12}});wake()}};
}
function fixture(throwOnStart=false) {
  const host=document.createElement('div');
  host.innerHTML='<div class="icen-ai-chat-scroll"></div><div class="icen-ai-composer" data-icen-ai-composer><div class="icen-ai-composer-queue" hidden></div><div class="icen-ai-composer-box"><textarea class="icen-ai-composer-input"></textarea><button type="button" data-icen-ai-send></button></div></div>';
  document.body.append(host);
  const composer=host.querySelector<HTMLElement>('.icen-ai-composer')!, messages=host.querySelector<HTMLElement>('.icen-ai-chat-scroll')!,field=host.querySelector('textarea')!;
  const sessions:ReturnType<typeof session>[]=[]; const requests:AiChatRequest[]=[];
  const client:AiClient={config:{provider:'test',baseURL:'',model:'test-model'},chat:async()=>({text:'',usage:{}}),stream(req){requests.push(req);if(throwOnStart)throw new Error('连接失败，请重试');const s=session();sessions.push(s);return s.handle}};
  cleanups.push(initAiComposer(host));
  const binding=bindComposer(composer,{client,messages});cleanups.push(()=>binding.unbind());
  cleanups.push(()=>sessions.forEach(s=>s.finish()));
  const send=(text:string)=>{field.value=text;field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));};
  return {composer,messages,field,client,binding,sessions,requests,send};
}

test('stop pauses the queue immediately, retains partial output and lets an idle editor retrieve queued work',async()=>{
  const f=fixture();f.send('整理证据');f.sessions[0]!.push({type:'text',delta:'已有证据'});await tick();f.send('再核对来源');
  f.composer.querySelector<HTMLButtonElement>('[data-icen-ai-send]')!.click();
  expect(f.composer.classList.contains('is-running')).toBe(false);
  expect(f.messages.textContent).toContain('已停止');expect(f.messages.textContent).toContain('已有证据');
  expect(f.messages.querySelectorAll('.is-streaming')).toHaveLength(0);
  f.sessions[0]!.push({type:'text',delta:'不应出现'});f.sessions[0]!.finish();await tick();
  expect(f.requests).toHaveLength(1);expect(f.messages.textContent).not.toContain('不应出现');
  expect(f.sessions[0]!.cancelled).toBe(1);
  f.field.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
  expect(f.field.value).toBe('再核对来源');expect(f.composer.querySelector('.icen-ai-composer-queue')!.hasAttribute('hidden')).toBe(true);
});

test('failure pauses queued requests; retry reuses the response and preserves a new input draft',async()=>{
  const f=fixture();f.send('第一条');f.send('排队的一条');
  f.sessions[0]!.push({type:'error',message:'暂时不可用'});f.sessions[0]!.finish('');await tick();
  expect(f.requests).toHaveLength(1);expect(f.binding.retry instanceof Function).toBe(true);
  const response=f.messages.querySelector('.icen-ai-msg--assistant')!;
  f.field.value='正在写的下一条';
  response.querySelector<HTMLButtonElement>('.icen-ai-msg-continue')!.click();
  expect(f.requests).toHaveLength(2);expect(f.binding.retry()).toBe(false);
  expect(f.messages.querySelector('.icen-ai-msg--assistant')===response).toBe(true);
  expect(f.messages.querySelectorAll('.icen-ai-msg--user')).toHaveLength(1);
  expect(f.field.value).toBe('正在写的下一条');
  f.sessions[1]!.push({type:'text',delta:'成功'});f.sessions[1]!.finish('成功');await tick();
  expect(f.requests).toHaveLength(3);expect(f.requests[2]!.messages.map(m=>m.content)).toEqual(['第一条','成功','排队的一条']);
});

test('unbind invalidates late chunks and completion before another binding starts',async()=>{
  const f=fixture();f.send('旧请求');f.binding.unbind();
  const newer=bindComposer(f.composer,{client:f.client,messages:f.messages});cleanups.push(()=>newer.unbind());
  f.send('新请求');const before=f.messages.textContent;
  f.sessions[0]!.push({type:'text',delta:'旧的迟到结果'});f.sessions[0]!.finish();await tick();
  expect(f.messages.textContent).toBe(before);expect(f.composer.classList.contains('is-running')).toBe(true);expect(f.requests).toHaveLength(2);
  f.sessions[1]!.finish();await tick();expect(f.composer.classList.contains('is-running')).toBe(false);
});

test('a synchronous client failure settles as a retryable response instead of leaving a busy editor',async()=>{
  const f=fixture(true);f.send('连接');await tick();
  expect(f.composer.classList.contains('is-running')).toBe(false);expect(f.messages.textContent).toContain('连接失败，请重试');
  expect(f.messages.querySelectorAll('.is-streaming')).toHaveLength(0);expect(f.binding.retry()).toBe(true);await tick();
  expect(f.messages.querySelectorAll('.icen-ai-msg--assistant')).toHaveLength(1);
});
