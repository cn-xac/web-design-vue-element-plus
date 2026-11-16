<script setup lang="ts">
/**
 * 标签页（re0BNA）。
 *
 * items 支持两种形态，运行时统一归一为 TabItem[]：
 * - 旧：`标题:内容,标题:内容` 成对字符串，内容为纯文本；
 * - 新：结构化 [{ id, label, mark, text, dataPath, url }]。
 *
 * 页签内容来源，按优先级 dataPath → url → text 解析：
 * - dataPath：绑定数据里的 schema 路径，运行时按 schema 协议解析为页面；
 * - url：外部 URL（返回 schema JSON），拉取后按 schema 协议解析为页面。
 * 内嵌页共用宿主 scope，与宿主表单共享同一份数据。
 *
 * 设计态只做只读预览（mode=edit、不发请求、不挂事件），避免设计器里误触发表单行为。
 */
import { computed, inject, reactive, ref, useSlots, watch, type VNode } from "vue";
import {
  getByPath,
  parseTabItems,
  request,
  type NodeSchema,
  type PageSchema,
  type TabItem,
} from "@x-ac/web-design-core";
import { RENDER_ENV, SchemaFragment } from "@x-ac/web-design-vue";

const props = withDefaults(
  defineProps<{
    items?: string | TabItem[];
    active?: string;
    type?: "" | "card" | "border-card";
    tabPosition?: "top" | "right" | "bottom" | "left";
    stretch?: boolean;
    closable?: boolean;
  }>(),
  { items: "", active: "", type: "", tabPosition: "top", stretch: false, closable: false },
);

/** 渲染环境：物料组件拿不到 props.scope，只能从注入里取（见 SchemaNode provide） */
const env = inject(RENDER_ENV, null);
const scope = computed<Record<string, unknown>>(() => env?.scope ?? {});
/** 设计态不渲染真实交互，只做静态预览 */
const embedMode = computed<"view" | "edit">(() => (env?.design ? "edit" : (env?.mode ?? "view")));

const tabs = computed<TabItem[]>(() => parseTabItems(props.items));

/**
 * design 页签的 pane 容器由渲染器作为默认 slot 传入（每个是 SchemaNode 组件 VNode，
 * props.node 即容器 NodeSchema）。物料按 paneId 取回对应 VNode 渲染到该页签。
 * 与 React 侧 TabsBlock 的 paneChildOf 语义对齐。
 */
const slots = useSlots();
function paneVNodes(tab: TabItem): VNode[] {
  const list = slots.default?.() ?? [];
  return list.filter((vnode) => {
    const node = (vnode.props as { node?: { props?: { paneId?: unknown } } } | null)?.node;
    return node?.props?.paneId === tab.id;
  });
}
function hasPane(tab: TabItem): boolean {
  return paneVNodes(tab).length > 0;
}

/** 函数式组件：把 VNode 数组渲染到模板里（Vue 模板无法直接插 VNode 数组） */
const PaneVNodes = (props: { nodes: VNode[] }): VNode[] => props.nodes;

const current = ref("");
watch(
  () => [props.items, props.active] as const,
  () => {
    const raw = String(props.active ?? "").trim();
    // 先按 label 匹配；匹配不到再按自定义 mark 匹配，实现「数据控制默认激活」
    const at = tabs.value.findIndex(
      (tab) => tab.label === raw || (tab.mark !== undefined && tab.mark === raw),
    );
    // 配置的默认项找不到（如标题被改过）时回到第一项，避免整页没有激活页签
    if (!tabs.value.length) current.value = "";
    else if (raw && at >= 0) current.value = String(at);
    else current.value = "0";
  },
  { immediate: true },
);

/* ---------------- 外部 URL：拉取 schema JSON ---------------- */

interface RemoteState {
  loading: boolean;
  error: string;
  data?: PageSchema | NodeSchema[];
}

const remote = reactive<Record<string, RemoteState>>({});

function loadRemote(tab: TabItem): void {
  if (!tab.url || remote[tab.url]) return;
  const url = tab.url;
  remote[url] = { loading: true, error: "" };
  const pending = tab.method === "post" ? request.post(url) : request.get(url);
  pending
    .then((res) => {
      remote[url] = { loading: false, error: "", data: res.data as PageSchema | NodeSchema[] };
    })
    .catch((error: unknown) => {
      remote[url] = {
        loading: false,
        error: `内容加载失败：${(error as Error)?.message ?? String(error)}`,
      };
    });
}

watch(
  () => tabs.value.map((tab) => `${tab.method ?? "get"}:${tab.url ?? ""}`).join("|"),
  () => {
    if (env?.design) return; // 设计态不打接口，只预览已有内容
    tabs.value.forEach(loadRemote);
  },
  { immediate: true },
);

/** 解析页签内嵌内容：dataPath 本地优先，其次 url 拉取结果 */
function embeddedOf(tab: TabItem): PageSchema | NodeSchema[] | null {
  if (tab.dataPath) {
    return (getByPath(scope.value, tab.dataPath) as PageSchema | NodeSchema[] | null) ?? null;
  }
  if (tab.url) return remote[tab.url]?.data ?? null;
  return null;
}

function remoteState(tab: TabItem): RemoteState | undefined {
  return tab.url ? remote[tab.url] : undefined;
}
</script>

<template>
  <el-tabs
    v-model="current"
    :type="type || undefined"
    :tab-position="tabPosition"
    :stretch="stretch"
    :closable="closable"
  >
    <el-tab-pane v-for="(tab, index) in tabs" :key="tab.id" :label="tab.label" :name="String(index)">
      <!-- 有 pane 容器就优先渲染（可拖拽编辑 / 数据驱动），不再依赖 content 字段，
           兼容本期之前创建、尚未写 content 的旧页面 -->
      <PaneVNodes v-if="hasPane(tab)" :nodes="paneVNodes(tab)" />
      <SchemaFragment
        v-else-if="embeddedOf(tab)"
        :page="embeddedOf(tab)"
        :scope="scope"
        :mode="embedMode"
        :design="false"
      />
      <div v-else-if="remoteState(tab)?.loading" class="wb-tabs__state">加载中…</div>
      <div v-else-if="remoteState(tab)?.error" class="wb-tabs__state wb-tabs__state--error">
        {{ remoteState(tab)?.error }}
      </div>
      <!-- 纯文本只兼容旧页面；设计器已不再提供该来源，建议改用文本标签节点 -->
      <div v-else-if="tab.text" class="wb-tabs__body">{{ tab.text }}</div>
      <div v-else-if="env?.design" class="wb-tabs__state">空页签 · 从左侧物料面板拖入组件</div>
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.wb-tabs__body {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  padding: 4px 0;
}
.wb-tabs__state {
  padding: 8px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.wb-tabs__state--error {
  color: var(--el-color-danger);
}
</style>
