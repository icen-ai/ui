import {afterEach,expect,test} from 'bun:test';
import {renderCodeBlock,codeBlockHTML,initCodeBlock} from '../../src/behaviors/code-block';
const cleanup:(()=>void)[]=[];
const wait=(ms=0)=>new Promise((resolve)=>setTimeout(resolve,ms));
function fixture(code='one\n\nthree\n',fold=false){const host=document.createElement('div');document.body.append(host);renderCodeBlock(host,{code,fold,file:'src/example.ts'});const fig=host.querySelector<HTMLElement>('figure')!;const dispose=initCodeBlock(host);cleanup.push(dispose);return {host,fig,dispose,button:fig.querySelector<HTMLButtonElement>('[data-icen-code-block-copy]')!};}
function clipboard(writeText:(text:string)=>Promise<void>){const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});cleanup.push(()=>{if(original)Object.defineProperty(navigator,'clipboard',original);else delete (navigator as any).clipboard;});}
afterEach(()=>{cleanup.splice(0).reverse().forEach((fn)=>fn());document.body.replaceChildren();});

test('SSR and DOM keep blank lines, one terminal newline policy, shared symbols and a named keyboard region',()=>{
  const {fig}=fixture();const pre=fig.querySelector('pre')!;expect(pre.tabIndex).toBe(0);expect(pre.getAttribute('role')).toBe('region');expect(pre.getAttribute('aria-label')).toBe('src/example.ts');
  expect(fig.querySelector('[data-icen-code-block-wrap]')?.getAttribute('aria-controls')).toBe(pre.id);
  expect([...fig.querySelectorAll('.icen-code-block-line')].map((el)=>el.textContent)).toEqual(['one','','three']);
  const server=document.createElement('div');server.innerHTML=codeBlockHTML({code:'one\n\nthree\n'});expect([...server.querySelectorAll('.icen-code-block-line')].map((el)=>el.textContent)).toEqual(['one','','three']);
  expect([...fig.querySelectorAll('svg')].every((svg)=>svg.getAttribute('viewBox') === '0 0 20 20')).toBe(true);
});

test('nested delegation applies one action, repeated init returns the owner disposer and stale disposers cannot stop a new scope',()=>{
  const {host,fig,dispose}=fixture();const global=initCodeBlock();cleanup.push(global);let changes=0;fig.addEventListener('icen:code-block-toggle',()=>changes++);
  expect(initCodeBlock(host) === dispose).toBe(true);fig.querySelector<HTMLButtonElement>('[data-icen-code-block-wrap]')!.click();expect(changes).toBe(1);expect(fig.classList.contains('icen-code-block--wrap')).toBe(true);
  global();dispose();const next=initCodeBlock(host);cleanup.push(next);dispose();fig.querySelector<HTMLButtonElement>('[data-icen-code-block-wrap]')!.click();expect(changes).toBe(2);
});

test('copy deduplicates pending work, preserves blank lines, reports failure and can immediately retry',async()=>{
  let done!:(value?:void)=>void,calls=0,copied='';clipboard((text)=>{calls++;copied=text;return new Promise<void>((resolve)=>{done=resolve;});});
  const {fig,button}=fixture();button.click();button.click();expect(calls).toBe(1);expect(button.getAttribute('aria-busy')).toBe('true');expect(copied).toBe('one\n\nthree');done();await wait();expect(button.classList.contains('is-done')).toBe(true);expect(fig.querySelector('[role="status"]')?.textContent).toBe('已复制');
});

test('destroy cancels UI continuations and suppresses legacy fallback after a late clipboard rejection',async()=>{
  let reject!:(error:Error)=>void,fallbacks=0;clipboard(()=>new Promise<void>((_resolve,no)=>{reject=no;}));const original=document.execCommand;document.execCommand=()=>{fallbacks++;return false;};cleanup.push(()=>document.execCommand=original);
  const {fig,button,dispose}=fixture();let reported=0;fig.addEventListener('icen:copy-error',()=>reported++);button.click();dispose();reject(new Error('Denied'));await wait();
  expect(fallbacks).toBe(0);expect(reported).toBe(0);expect(button.hasAttribute('aria-busy')).toBe(false);expect(fig.querySelectorAll('.icen-code-block-feedback').length).toBe(0);
});

test('copy failure is visible and retry succeeds without leaving the old error status',async()=>{
  let calls=0;clipboard(async()=>{if(++calls === 1)throw new Error('Denied');});const original=document.execCommand;document.execCommand=()=>false;cleanup.push(()=>document.execCommand=original);
  const {fig,button}=fixture();button.click();await wait();expect(fig.querySelector('.icen-code-block-feedback')?.textContent).toBe('未能复制，请重试。');expect(button.getAttribute('aria-label')).toBe('重试复制');
  button.click();await wait();expect(fig.querySelectorAll('.icen-code-block-feedback').length).toBe(1);expect(button.classList.contains('is-error')).toBe(false);expect(button.classList.contains('is-done')).toBe(true);
});

test('rapid reverse folds settle the final intention and teardown removes animation residue',async()=>{
  const {fig,dispose}=fixture(Array.from({length:42},(_,i)=>'line '+i).join('\n'),true);const pre=fig.querySelector('pre')!,tail=fig.querySelector<HTMLButtonElement>('.icen-code-block-tail')!;
  Object.defineProperty(pre,'getBoundingClientRect',{value:()=>({height:264})});Object.defineProperty(pre,'scrollHeight',{value:900});pre.style.transitionDuration='20ms';
  tail.click();tail.click();tail.click();expect(fig.classList.contains('is-folded')).toBe(false);expect(tail.getAttribute('aria-expanded')).toBe('true');await wait(130);expect(pre.style.maxHeight).toBe('');
  tail.click();dispose();await wait(130);expect(pre.style.maxHeight).toBe('');expect(fig.classList.contains('is-folded')).toBe(true);
});
