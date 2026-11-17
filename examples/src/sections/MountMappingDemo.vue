<script setup lang="ts">
/**
 * 映射测试 · 容器挂载：一个完整页面里，一部分节点固定，另一部分由编辑的 JSON 实时解析后
 * 挂载到「选中的容器」下，并演示用 {{}} 指定字段的绑定位置（数据来自表单 scope）。
 *
 * 与「构建与渲染」的区别：这里不是两块独立渲染，而是把 JSON 节点**注入同一棵页面树**的指定容器，
 * 固定节点与动态节点一起渲染，直观看到「远程片段挂载到页面某容器」的效果。
 *
 * 不改引擎：挂载是示例层的纯函数（深拷贝宿主 + 递归找容器 + 写入 children），
 * 渲染仍走 SchemaRenderer，{{}} 绑定走 core 既有表达式引擎。
 */
import { computed, ref, watch } from "vue";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { NodeSchema, PageSchema } from "@x-ac/web-design-core";

/** 模板里不能直接写 {{}} 字面量（会被当插值提前闭合），放脚本常量 */
const BIND_HINT = "{{form.mount_user}}";
const BRACES = "{{}}";

/** 宿主页面：固定节点 + 三个可作挂载目标的容器（id 稳定，供下拉选择） */
const HOST: PageSchema = {
  schemaVersion: "1.3.0",
  id: "page_mount_mapping",
  type: "page",
  meta: { title: "容器挂载映射" },
  state: {},
  children: [
    { id: "mm_title", component: "ec-title", props: { text: "容器挂载映射 · 固定 + 动态混排", level: 3 } },
    {
      id: "mm_intro",
      component: "ec-alert",
      props: {
        type: "info",
        title: "同一页面：固定节点 + 选中容器下挂载 JSON 节点",
        description: "左侧选容器、编辑 JSON 节点片段；片段里的 {{form.xxx}} 会绑定右侧表单数据。固定节点与动态节点一起渲染。",
        showIcon: true,
      },
    },
    { id: "mm_fixed", component: "ec-input", props: { label: "固定字段（不随 JSON 变）" } },
    { id: "target_card", component: "ec-card", props: { title: "挂载容器 A · ec-card" }, children: [] },
    { id: "target_container", component: "ec-container", props: {} , children: [] },
    { id: "target_space", component: "ec-space", props: { wrap: true }, children: [] },
  ],
};

/** 候选容器（id → 展示名）；与 HOST 里的容器 id 一一对应 */
const CONTAINERS = [
  { id: "target_card", label: "挂载容器 A · 卡片" },
  { id: "target_container", label: "挂载容器 B · 基础容器" },
  { id: "target_space", label: "挂载容器 C · 弹性容器" },
];

/** 默认注入的 JSON 片段：三个控件，绑定位置用 {{form.xxx}} 指定 */
const DEFAULT_INJECT = JSON.stringify(
  [
    { id: "mount_user", component: "ec-input", props: { label: "用户名（绑定 form.mount_user）", modelValue: "{{form.mount_user}}" } },
    { id: "mount_role", component: "ec-select", props: { label: "角色（绑定 form.mount_role）", modelValue: "{{form.mount_role}}", options: ["管理员", "编辑", "访客"] } },
    { id: "mount_show", component: "ec-text", props: { text: "回显：{{form.mount_user}} / {{form.mount_role}}" } },
  ],
  null,
  2,
);

/** 表单数据：{{}} 绑定的取值来源 */
const DEFAULT_DATA = JSON.stringify({ form: { mount_user: "王五", mount_role: "管理员" } }, null, 2);

const targetId = ref(CONTAINERS[0]!.id);
const injectText = ref(DEFAULT_INJECT);
const dataText = ref(DEFAULT_DATA);
const parseError = ref("");
const dataError = ref("");

/** 深拷贝 + 递归把节点挂到目标容器下；非目标容器原样复制 */
function mountInto(host: PageSchema, id: string, injected: NodeSchema[]): PageSchema {
  const clone = JSON.parse(JSON.stringify(host)) as PageSchema;
  const walk = (nodes: NodeSchema[]): void => {
    for (const node of nodes ?? []) {
      if (node.id === id) {
        node.children = [...(node.children ?? []), ...injected];
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(clone.children ?? []);
  return clone;
}

/** 防抖解析 JSON 片段 + 表单数据，任一失败保留上次成功结果 */
const injectedNodes = ref<NodeSchema[]>(JSON.parse(DEFAULT_INJECT) as NodeSchema[]);
const formData = ref<Record<string, unknown>>(JSON.parse(DEFAULT_DATA) as Record<string, unknown>);
let debounce: ReturnType<typeof setTimeout> | undefined;
watch([injectText, dataText], () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    try {
      const parsed = JSON.parse(injectText.value);
      if (!Array.isArray(parsed)) throw new Error("片段必须是节点数组 [...]");
      injectedNodes.value = parsed as NodeSchema[];
      parseError.value = "";
    } catch (error) {
      parseError.value = (error as Error).message;
    }
    try {
      const d = JSON.parse(dataText.value) as Record<string, unknown>;
      if (!d || typeof d !== "object") throw new Error("数据必须是对象");
      formData.value = d;
      dataError.value = "";
    } catch (error) {
      dataError.value = (error as Error).message;
    }
  }, 300);
});

/** 挂载后的完整页面：固定节点 + 注入片段 */
const mountedPage = computed<PageSchema>(() => mountInto(HOST, targetId.value, injectedNodes.value));

/** 当前 JSON 片段里出现的 {{...}} 绑定路径（用于演示绑定位置） */
const bindings = computed<string[]>(() => {
  const found = new Set<string>();
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(injectText.value))) found.add(m[1]!);
  return [...found];
});
</script>

<template>
  <section class="mountmap">
    <div class="mountmap__grid">
      <!-- 左：控制区（选容器 + 编辑 JSON + 数据） -->
      <div class="mountmap__ctrl">
        <h3 class="mountmap__title">挂载配置</h3>

        <label class="mountmap__label">挂载目标容器</label>
        <el-select v-model="targetId" size="small" class="mountmap__full">
          <el-option v-for="c in CONTAINERS" :key="c.id" :label="c.label" :value="c.id" />
        </el-select>
        <p class="mountmap__hint">JSON 节点片段会挂到该容器的 children 下，与固定节点一起渲染。</p>

        <label class="mountmap__label">JSON 节点片段（{{ BIND_HINT }} 指定绑定位置）</label>
        <div v-if="parseError" class="mountmap__error">片段解析失败：{{ parseError }}</div>
        <el-input v-model="injectText" type="textarea" :rows="12" size="small" class="mountmap__code" spellcheck="false" />

        <label class="mountmap__label">表单数据（{{ BRACES }} 绑定的取值来源）</label>
        <div v-if="dataError" class="mountmap__error">数据解析失败：{{ dataError }}</div>
        <el-input v-model="dataText" type="textarea" :rows="5" size="small" class="mountmap__code" spellcheck="false" />

        <div class="mountmap__bindings">
          <span class="mountmap__label">检测到的绑定位置</span>
          <el-tag v-for="b in bindings" :key="b" size="small" type="primary" class="mountmap__tag">{{ b }}</el-tag>
          <span v-if="!bindings.length" class="mountmap__hint">JSON 里写 {{ BIND_HINT }} 即可绑定表单数据</span>
        </div>
      </div>

      <!-- 右：完整页面渲染（固定节点 + 动态挂载节点） -->
      <div class="mountmap__render">
        <div class="mountmap__render-head">
          <h3 class="mountmap__title">渲染结果 · 固定 + 动态混排</h3>
          <el-tag size="small" type="success">已挂载 {{ injectedNodes.length }} 个节点 → {{ targetId }}</el-tag>
        </div>
        <div class="mountmap__canvas">
          <SchemaRenderer :page="mountedPage" :data="formData" :key="`mount-${targetId}`" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mountmap { display: flex; flex: 1; height: 100%; min-height: 0; }
.mountmap__grid { display: grid; grid-template-columns: 420px 1fr; gap: 16px; flex: 1; min-width: 0; min-height: 0; }
.mountmap__ctrl, .mountmap__render { min-width: 0; min-height: 0; background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; padding: 16px; overflow: auto; }
.mountmap__render { display: flex; flex-direction: column; }
.mountmap__render-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; }
.mountmap__title { margin: 0 0 12px; font-size: 14px; color: #1d2129; }
.mountmap__render-head .mountmap__title { margin: 0; }
.mountmap__label { display: block; font-size: 12px; font-weight: 600; color: #4e5969; margin: 12px 0 6px; }
.mountmap__hint { font-size: 11px; color: #86909c; line-height: 1.6; margin: 6px 0 0; }
.mountmap__full { width: 100%; }
.mountmap__code :deep(textarea) { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.5; }
.mountmap__error { margin: 8px 0; padding: 6px 10px; background: #fef0f0; border: 1px solid #fbc4c4; border-radius: 6px; color: #c0392b; font-size: 11px; }
.mountmap__bindings { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e5e6eb; }
.mountmap__tag { margin: 4px 6px 0 0; }
.mountmap__canvas { padding: 16px; background: #fafbfc; border: 1px solid #e5e6eb; border-radius: 6px; flex: 1; min-height: 0; overflow: auto; }
@media (max-width: 1100px) { .mountmap__grid { grid-template-columns: 1fr; } }
</style>
