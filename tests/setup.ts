// 测试全局 setup：注册 happy-dom 的 DOM 全局（document/window/HTMLElement…），
// 行为模块的 SSR 守卫在测试环境里走浏览器分支。
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
