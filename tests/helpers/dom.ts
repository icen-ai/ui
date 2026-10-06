// DOM 测试工具：mount 进 document.body 挂的容器，unmountAll 统一清场，
// 保证用例间互不串味（init 幂等标记、单例 tooltip 等都挂在 body 子树上）。

let host: HTMLElement | null = null;

function hostEl(): HTMLElement {
  if (!host || !host.isConnected) {
    host = document.createElement('div');
    host.setAttribute('data-test-host', '');
    document.body.appendChild(host);
  }
  return host;
}

/** html 挂进测试容器并返回容器元素（用例内 querySelector 自取）。 */
export function mount(html: string): HTMLElement {
  const el = hostEl();
  el.innerHTML = html;
  return el;
}

/** 清空全部已挂载内容（幂等标记随元素一并销毁，跨用例零残留）。 */
export function unmountAll(): void {
  if (host) {
    host.innerHTML = '';
    host.remove();
    host = null;
  }
}

/** 等一拍微任务/宏任务（渲染与事件回流后的断言用）。 */
export function nextTick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 派发事件：bubbles 默认 true（行为层全部容器委托，依赖冒泡）。 */
export function fire(el: Element, type: string, init: EventInit = {}): Event {
  const ev = new Event(type, { bubbles: true, composed: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}
