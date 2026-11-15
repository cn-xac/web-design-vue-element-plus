import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { createVueDesign } from "@x-ac/web-design-vue";
import "@x-ac/web-design-vue/style.css";
import { elementPlusAdapter } from "@x-ac/web-design-vue-element-plus";
import "./styles.css";
import App from "./App.vue";
import { installExternalMock } from "./mock/install-mock";

// 静态示例站没有后端：拦截 /mock/api/* 返回本地 JSON，让外部数据源示例真实可用。
installExternalMock();

const app = createApp(App);
app.use(ElementPlus);
// 设计器（@x-ac/web-design-vue/designer）的 store 基于 pinia，须先挂载单例。
app.use(createPinia());
// 全局注入 Element Plus 适配包：宿主应用只需这一行即可接入 Schema 渲染与数据绑定。
app.use(createVueDesign({ adapter: elementPlusAdapter }));
app.mount("#app");
