<script setup lang="ts">
/**
 * 新示例 · 构建与渲染对比（左右两半）：
 * - 左「固定构建」：一份预先构建好的 Schema，直接渲染成页面（含各种容器）。
 * - 右「编辑构建」：可编辑的 Schema JSON，输入后防抖实时渲染；也可「从接口加载」把
 *   远端 Schema 填进编辑器再渲染，演示「通过接口获取并渲染」。
 *
 * 两条路径最终都走 SchemaRenderer，证明「同一份 Schema，无论写死还是接口来，
 * 都能解析成同样的页面」。不改引擎。
 */
import { computed, onMounted, ref, watch } from "vue";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { PageSchema } from "@x-ac/web-design-core";
import { TEST_API } from "../mock/install-mock";
import { fetchSchemaPage } from "../url-mapping";
import builtSchema from "../mock/schema-page.json";

/** 模板里不能直接写 {{}} 字面量（会被当插值提前闭合），放脚本常量供模板引用 */
const BIND_HINT = "{{form.xxx}}";

/** 编辑器初始骨架：比完整示例短，方便现场改字段验证实时渲染 */
const STARTER = {
  schemaVersion: "1.3.0",
  id: "page_live_edit",
  type: "page",
  meta: { title: "实时编辑构建" },
  state: { form: { live_name: "改我试试", live_note: "这段来自 state.form" } },
  children: [
    { id: "live_title", component: "ec-title", props: { text: "我在编辑 JSON 构建页面", level: 3 } },
    {
      id: "live_card",
      component: "ec-card",
      props: { title: "卡片容器", shadow: "never" },
      children: [
        { id: "live_name", component: "ec-input", props: { label: "姓名" } },
        { id: "live_note", component: "ec-textarea", props: { label: "备注", rows: 2, type: "textarea" } },
      ],
    },
  ],
};

const builtPage = builtSchema as unknown as PageSchema;

const editorText = ref(JSON.stringify(STARTER, null, 2));
const livePage = ref<PageSchema>(STARTER as unknown as PageSchema);
const parseError = ref("");
const loadingRemote = ref(false);
const remoteUrl = ref(TEST_API.schemaPage);
const remoteError = ref("");

/** 防抖：停止输入 300ms 后再解析渲染，避免逐字输入时反复重挂载 */
let debounce: ReturnType<typeof setTimeout> | undefined;
watch(editorText, (text) => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    try {
      const parsed = JSON.parse(text) as PageSchema;
      if (!parsed || !Array.isArray(parsed.children)) throw new Error("缺少 children 数组");
      livePage.value = parsed;
      parseError.value = "";
    } catch (error) {
      // 保留上一次成功渲染的页面，不因半截 JSON 白屏
      parseError.value = (error as Error).message;
    }
  }, 300);
});

async function loadFromApi(): Promise<void> {
  if (!remoteUrl.value.trim()) return;
  loadingRemote.value = true;
  remoteError.value = "";
  const result = await fetchSchemaPage(remoteUrl.value.trim(), 2000);
  loadingRemote.value = false;
  if (!result.ok) {
    remoteError.value = result.message;
    return;
  }
  // 接口内容填进编辑器 → 走同一条实时渲染链路
  editorText.value = JSON.stringify(result.page, null, 2);
}

const builtNodes = computed(() => builtPage.children?.length ?? 0);
</script>

<template>
  <section class="buildrender">
    <div class="buildrender__grid">
      <!-- 左：固定构建好的 Schema，直接渲染 -->
      <div class="buildrender__half">
        <div class="buildrender__half-head">
          <h3 class="buildrender__title">固定构建 · 直接渲染</h3>
          <el-tag size="small" type="success">预构建 Schema · {{ builtNodes }} 个顶层节点</el-tag>
        </div>
        <p class="buildrender__desc">
          这是一份事先构建好、写死在示例里的 Schema（卡片 / 栅格 / 页签 / 子表单）。引擎按协议解析成页面，字段由
          <code>{{ BIND_HINT }}</code> 回填。
        </p>
        <div class="buildrender__canvas">
          <SchemaRenderer :page="builtPage" :data="builtPage.state" :key="`built-${builtPage.id}`" />
        </div>
      </div>

      <!-- 右：编辑 JSON 实时渲染 + 从接口加载 -->
      <div class="buildrender__half">
        <div class="buildrender__half-head">
          <h3 class="buildrender__title">编辑 JSON · 实时渲染</h3>
          <el-tag size="small" :type="parseError ? 'danger' : 'primary'">
            {{ parseError ? "JSON 有误" : "实时解析中" }}
          </el-tag>
        </div>
        <p class="buildrender__desc">
          直接改下方 Schema JSON（改字段、加容器），停止输入 300ms 后右侧实时重渲染；也可从接口拉取 Schema 填进编辑器。
        </p>
        <div class="buildrender__api">
          <el-input v-model="remoteUrl" size="small" placeholder="Schema JSON 的 URL" />
          <el-button size="small" :loading="loadingRemote" @click="loadFromApi">从接口加载</el-button>
        </div>
        <div v-if="remoteError" class="buildrender__error">接口加载失败：{{ remoteError }}</div>
        <div class="buildrender__split">
          <el-input
            v-model="editorText"
            type="textarea"
            :rows="14"
            size="small"
            class="buildrender__editor"
            spellcheck="false"
          />
          <div class="buildrender__canvas buildrender__canvas--live">
            <div v-if="parseError" class="buildrender__error">JSON 解析失败：{{ parseError }}（下方仍是上次成功的渲染）</div>
            <SchemaRenderer :page="livePage" :data="livePage.state" :key="`live-${livePage.id}`" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.buildrender {
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
}
.buildrender__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.buildrender__half {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}
.buildrender__half-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.buildrender__title {
  margin: 0;
  font-size: 14px;
  color: #1d2129;
}
.buildrender__desc {
  margin: 6px 0 10px;
  font-size: 12px;
  line-height: 1.7;
  color: #86909c;
}
.buildrender__desc code {
  color: #165dff;
}
.buildrender__api {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.buildrender__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.buildrender__editor :deep(textarea) {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  height: 100%;
  min-height: 360px;
}
.buildrender__canvas {
  padding: 12px;
  background: #fafbfc;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  flex: 1;
  min-height: 200px;
  overflow: auto;
}
.buildrender__canvas--live {
  min-height: 360px;
}
.buildrender__error {
  margin-bottom: 8px;
  padding: 8px 10px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 6px;
  color: #c0392b;
  font-size: 12px;
}
@media (max-width: 1100px) {
  .buildrender__grid,
  .buildrender__split {
    grid-template-columns: 1fr;
  }
}
</style>
