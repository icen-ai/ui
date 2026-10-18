import {afterEach,expect,test} from 'bun:test';
import {createAutocomplete,type AutocompleteHandle} from '../../src/behaviors/autocomplete';
import {createMentions,type MentionsHandle,type MentionItem} from '../../src/behaviors/mentions';
const cleanup:(()=>void)[]=[];
const wait=(ms=0)=>new Promise((resolve)=>setTimeout(resolve,ms));
function pending<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function type(input:HTMLInputElement | HTMLTextAreaElement,value:string){input.value=value;if(input instanceof HTMLTextAreaElement)input.setSelectionRange(value.length,value.length);input.dispatchEvent(new Event('input',{bubbles:true}));}
function key(input:HTMLElement,value:string,options:KeyboardEventInit={}){const e=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options});input.dispatchEvent(e);return e;}
function auto(source:Parameters<typeof createAutocomplete>[1]['source'],delay=0){const input=document.createElement('input');document.body.append(input);const handle=createAutocomplete(input,{source,debounceMs:delay});cleanup.push(()=>handle.destroy());return {input,handle,panel:document.querySelector<HTMLElement>('.icen-autocomplete-panel')!};}
function mention(source:Parameters<typeof createMentions>[1]['source']){const field=document.createElement('textarea');document.body.append(field);const handle=createMentions(field,{source,debounceMs:0});const input=document.querySelector<HTMLElement>('.icen-mentions-editor')!;cleanup.push(()=>handle.destroy());return {input,handle,panel:document.querySelector<HTMLElement>('.icen-mentions-panel')!};}
/** mentions 编辑区整段输入：清区、caret 到末尾、插纯文本、派 input。 */
function editMention(editor:HTMLElement,value:string){while(editor.firstChild)editor.removeChild(editor.firstChild);if(value)editor.appendChild(document.createTextNode(value));const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);editor.dispatchEvent(new Event('input',{bubbles:true}));}
/** 测试侧 offset → DOM 位置（token 只计 bdi 文本，与实现同口径）。 */
function caretTo(editor:HTMLElement,offset:number){let acc=0;let pos:{node:Node;offset:number}={node:editor,offset:editor.childNodes.length};const children=Array.from(editor.childNodes);for(let i=0;i<children.length;i++){const child=children[i]!;const isToken=child instanceof HTMLElement&&child.classList.contains('icen-mention-token');const len=isToken?(child.querySelector('bdi')?.textContent??''):child instanceof Text?child.data.length:(child.textContent??'').length;if(child instanceof Text){if(offset<=acc+len){pos={node:child,offset:offset-acc};break;}}else if(offset<acc+len){pos={node:editor,offset:i};break;}else if(offset===acc+len){pos={node:editor,offset:i+1};break;}acc+=len;}const range=document.createRange();range.setStart(pos.node,pos.offset);range.collapse(true);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);}
afterEach(()=>{cleanup.splice(0).reverse().forEach((fn)=>fn());document.body.replaceChildren();});

test('autocomplete invalidates old work at keystroke time, including the next debounce window',async()=>{
  const requests:{query:string;signal:AbortSignal;result:ReturnType<typeof pending<string[]>>}[]=[];
  const {input,panel}=auto((query,{signal})=>{const result=pending<string[]>();requests.push({query,signal,result});return result.promise;},30);
  type(input,'a');await wait(45);expect(requests.length).toBe(1);type(input,'ab');expect(requests[0].signal.aborted).toBe(true);
  requests[0].result.resolve(['Stale']);await wait();expect(panel.querySelectorAll('[role="option"]').length).toBe(0);
  await wait(40);requests[1].result.resolve(['Fresh']);await wait();expect(panel.querySelector('[role="option"]')?.textContent).toBe('Fresh');
});

test('autocomplete close, blur, setValue and destroy never allow a pending result to reopen the popup',async()=>{
  for(const action of ['close','blur','set','destroy']){
    const result=pending<string[]>();let signal:AbortSignal | undefined;const {input,handle,panel}=auto((_q,ctx)=>{signal=ctx.signal;return result.promise;});
    type(input,'a');if(action === 'close')handle.close();if(action === 'blur')input.dispatchEvent(new FocusEvent('blur'));if(action === 'set')handle.setValue('Chosen');if(action === 'destroy')handle.destroy();
    expect(signal?.aborted).toBe(true);result.resolve(['Late']);await wait();expect(panel.hidden || !panel.isConnected).toBe(true);if(action === 'destroy'){handle.open();expect(document.querySelectorAll('.icen-autocomplete-panel').length).toBe(0);}else handle.destroy();
  }
});

test('failure is distinct from empty results and a retry keeps the query and the input focus',async()=>{
  let attempts=0;const {input,panel}=auto(()=>++attempts === 1 ? Promise.reject(new Error('Offline')) : ['Available']);input.focus();type(input,'a');await wait();
  expect(panel.querySelector<HTMLElement>('.icen-suggestion-status')?.hidden).toBe(false);expect(panel.querySelector<HTMLElement>('.icen-autocomplete-empty')?.hidden).toBe(true);
  expect(panel.querySelector('[role="listbox"] button')).toBeNull();panel.querySelector<HTMLButtonElement>('.icen-suggestion-retry')!.click();
  expect(attempts).toBe(2);expect(document.activeElement === input).toBe(true);expect(panel.querySelector('[role="option"]')?.textContent).toBe('Available');
});

test('both suggestion inputs leave every composition key alone and deduplicate the final native input',()=>{
  for(const mode of ['auto','mention']){
    let calls=0;const widget=mode === 'auto' ? auto(()=>{calls++;return ['item'];}) : mention(()=>{calls++;return [{id:'one',label:'item'}];});
    widget.input.dispatchEvent(new Event('compositionstart'));if(mode === 'auto')type(widget.input as HTMLInputElement,'item');else editMention(widget.input,'@item');
    for(const value of ['ArrowDown','ArrowUp','Enter','Escape'])expect(key(widget.input,value).defaultPrevented).toBe(false);
    expect(calls).toBe(0);widget.input.dispatchEvent(new Event('compositionend'));widget.input.dispatchEvent(new Event('input'));expect(calls).toBe(1);widget.handle.destroy();
  }
});

test('recreating a behavior restores authored ARIA, replaces its old owner, and readonly fields never query',()=>{
  const input=document.createElement('input');input.setAttribute('role','searchbox');input.setAttribute('aria-controls','authored');document.body.append(input);let calls=0;
  const first=createAutocomplete(input,{source:()=>{calls++;return ['Old'];},debounceMs:0});const next=createAutocomplete(input,{source:()=>{calls++;return ['New'];},debounceMs:0});cleanup.push(()=>next.destroy());
  first.destroy();type(input,'n');expect(calls).toBe(1);expect(document.querySelectorAll('.icen-autocomplete-panel').length).toBe(1);
  input.readOnly=true;type(input,'x');expect(calls).toBe(1);next.destroy();expect(input.getAttribute('role')).toBe('searchbox');expect(input.getAttribute('aria-controls')).toBe('authored');
});

test('mentions cancel closed requests and expose retryable failures without treating status as an option',async()=>{
  const result=pending<MentionItem[]>();let signal:AbortSignal | undefined;
  const first=mention((_q,ctx)=>{signal=ctx.signal;return result.promise;});editMention(first.input,'@a');first.handle.close();expect(signal?.aborted).toBe(true);result.resolve([{id:'a',label:'alice'}]);await wait();expect(first.panel.hidden).toBe(true);first.handle.destroy();
  let calls=0;const second=mention(()=>++calls === 1 ? Promise.reject(new Error('Offline')) : [{id:'a',label:'alice'}]);editMention(second.input,'@a');await wait();
  expect(second.panel.querySelector('[role="listbox"] [role="status"]')).toBeNull();key(second.input,'Enter');expect(calls).toBe(2);expect(second.panel.querySelector('[role="option"]')?.textContent).toBe('alice');
});

test('mention selection validates the live caret token, emits native input and deletes tokens atomically',()=>{
  const {input,handle,panel}=mention(()=>[{id:'a',label:'alice'}]);let native=0;input.addEventListener('input',()=>native++);editMention(input,'@a');key(input,'Enter');
  expect(input.textContent).toBe('@alice ');expect(native).toBe(2);expect(handle.getMentions().length).toBe(1);
  /* token 是对象单元：Backspace 整体删除（happy-dom 无原生默认删除，尾随空格手动同步浏览器行为） */
  key(input,'Backspace');
  const trailing=input.childNodes[input.childNodes.length-1] as Text;trailing.deleteData(trailing.data.length-1,1);
  caretTo(input,6);
  key(input,'Backspace');
  expect(input.textContent).toBe('');expect(handle.getMentions().length).toBe(0);
  /* caret 移进文本中间再点击：面板按 live caret 重新检测 */
  editMention(input,'@a and text');caretTo(input,2);input.dispatchEvent(new MouseEvent('click'));expect(panel.hidden).toBe(false);
  /* caret 挪到末尾（无 trigger）后点旧选项：校验 live caret 失败，关闭且不动文本 */
  caretTo(input,input.textContent!.length);panel.querySelector<HTMLElement>('[role="option"]')!.click();
  expect(input.textContent).toBe('@a and text');expect(panel.hidden).toBe(true);
});

test('inherited disabled state aborts both sources immediately and retry buttons have a logical tab return',async()=>{
  for(const mode of ['auto','mention']){
    const fieldset=document.createElement('fieldset'),input=document.createElement(mode === 'auto' ? 'input' : 'textarea');fieldset.append(input);document.body.append(fieldset);let signal:AbortSignal | undefined;
    const result=pending<any[]>(),source=(_q:string,context:{signal:AbortSignal})=>{signal=context.signal;return result.promise;};
    const handle=mode === 'auto' ? createAutocomplete(input as HTMLInputElement,{source,debounceMs:0}) : createMentions(input,{source,debounceMs:0});cleanup.push(()=>handle.destroy());
    if(mode === 'auto')type(input as HTMLInputElement,'a');else editMention(document.querySelector<HTMLElement>('.icen-mentions-editor')!,'@a');
    fieldset.disabled=true;await wait();expect(signal?.aborted).toBe(true);handle.destroy();
  }
  const {input,panel}=auto(()=>Promise.reject(new Error('Offline')));input.focus();type(input,'a');await wait();
  expect(key(input,'Tab').defaultPrevented).toBe(true);expect(document.activeElement?.classList.contains('icen-suggestion-retry')).toBe(true);
  key(document.activeElement as HTMLElement,'Tab',{shiftKey:true});expect(document.activeElement === input).toBe(true);
  key(input,'Tab');key(document.activeElement as HTMLElement,'Escape');expect(input.value).toBe('');expect(panel.hidden).toBe(true);expect(document.activeElement === input).toBe(true);
});
