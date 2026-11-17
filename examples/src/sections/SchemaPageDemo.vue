<script setup lang="ts">
/**
 * 完整实例：验证「JSON 数据解析成页面，包含各种容器」。
 *
 * 链路：URL 拉取遵循 Schema 协议的 JSON → SchemaRenderer 按协议渲染成真实页面
 * （card / row+col 栅格 / tabs 页签 / subform 子表单等容器嵌套）→
 * Schema.state.form 的表单数据通过 {{form.xxx}} 绑定回填到控件。
 *
 * 与四态测试台一样，不改引擎：SchemaRenderer 是引擎现成入口，这里只做示例装配。
 */
import { computed, onMounted, ref } from "vue";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { PageSchema } from "@x-ac/web-design-core";
import { TEST_API } from "../mock/install-mock";
import { fetchSchemaPage } from "../url-mapping";

/** 模板里不能直接写 {{}} 字面量（会被编译器当插值提前闭合），放脚本常量 */
const BIND_HINT = "{{form.xxx}}";

const url = ref<string>(TEST_API.schemaPage);
const page = ref<PageSchema | null>(null);
const formText = ref<string>("");
const loading = ref(false);
const error = ref("");
const showSchema = ref(false);

/** 传给渲染器的表单数据：优先用可编辑文本，解析失败则回退到 Schema.state.form */
const renderData = computed<Record<string, unknown> | undefined>(() => {
  if (!page.value) return undefined;
  try {
    const parsed = JSON.parse(formText.value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : (page.value.state as Record<string, unknown>);
  } catch {
    return page.value.state as Record<string, unknown>;
  }
});

const schemaText = computed(() => (page.value ? JSON.stringify(page.value, null, 2) : ""));

async function load(): Promise<void> {
  if (!url.value.trim()) return;
  loading.value = true;
  error.value = "";
  const result = await fetchSchemaPage(url.value.trim(), 2000);
  loading.value = false;
  if (!result.ok) {
    error.value = result.message;
    page.value = null;
    return;
  }
  page.value = result.page as unknown as PageSchema;
  // 把 Schema.state.form 填进编辑框，用户可现场改值验证表单数据映射
  const state = (result.page as { state?: { form?: unknown } }).state;
  formText.value = JSON.stringify(state?.form ?? {}, null, 2);
}

onMounted(load);
</script>

<template>
  <section class="schemapage">
    <div class="schemapage__head">
      <div>
        <h3 class="schemapage__title">完整实例 · JSON 解析成页面（含各种容器）</h3>
        <p class="schemapage__desc">
          URL 返回遵循 Schema 协议的 JSON → 渲染成真实页面（卡片 / 栅格 / 页签 / 子表单）→
          <code>Schema.state.form</code> 经 <code>{{ BIND_HINT }}</code> 回填。可编辑下方表单数据验证映射。
        </p>
      </div>
      <div class="schemapage__actions">
        <el-input v-model="url" size="small" class="schemapage__url" placeholder="Schema JSON 的 URL" />
        <el-button size="small" type="primary" :loading="loading" @click="load">重新加载</el-button>
      </div>
    </div>

    <div v-if="error" class="schemapage__error">加载失败：{{ error }}</div>

    <div v-if="page" class="schemapage__body">
      <div class="schemapage__data">
        <div class="schemapage__data-head">
          <h4 class="schemapage__subtitle">表单数据（映射到页面控件）</h4>
          <el-button link size="small" @click="showSchema = !showSchema">
            {{ showSchema ? "收起 Schema JSON" : "查看 Schema JSON" }}
          </el-button>
        </div>
        <el-input
          v-model="formText"
          type="textarea"
          :rows="10"
          size="small"
          class="schemapage__textarea"
          placeholder="JSON 对象，键对应控件的 form.xxx"
        />
        <pre v-if="showSchema" class="schemapage__code">{{ schemaText }}</pre>
        <p class="schemapage__note">
          页面与数据均来自同一个 JSON：修改上方数据后，右侧控件的回填值随之变化（双向绑定）。
        </p>
      </div>

      <div class="schemapage__render">
        <h4 class="schemapage__subtitle">渲染结果 · 由 JSON 生成的真实页面</h4>
        <div class="schemapage__canvas">
          <SchemaRenderer :page="page" :data="renderData" :key="page.id" />
        </div>
      </div>
    </div>
    <el-empty v-else-if="!loading" description="未加载到 Schema 页面" :image-size="60" />
  </section>
</template>

<style scoped>
.schemapage {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 18px;
}
.schemapage__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.schemapage__title {
  margin: 0;
  font-size: 15px;
  color: #1d2129;
}
.schemapage__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #86909c;
}
.schemapage__desc code {
  color: #165dff;
}
.schemapage__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.schemapage__url {
  width: 260px;
}
.schemapage__error {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 6px;
  color: #c0392b;
  font-size: 13px;
}
.schemapage__body {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  margin-top: 14px;
  flex: 1;
  min-height: 0;
}
.schemapage__data,
.schemapage__render {
  overflow: auto;
}
.schemapage__data,
.schemapage__render {
  min-width: 0;
}
.schemapage__data-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.schemapage__subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
}
.schemapage__data-head .schemapage__subtitle {
  margin-bottom: 8px;
}
.schemapage__textarea :deep(textarea) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
}
.schemapage__code {
  margin: 8px 0 0;
  padding: 10px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.schemapage__note {
  margin: 8px 0 0;
  font-size: 11px;
  color: #86909c;
  line-height: 1.6;
}
.schemapage__canvas {
  padding: 16px;
  background: #fafbfc;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  max-height: 560px;
  overflow: auto;
}
@media (max-width: 1000px) {
  .schemapage__body {
    grid-template-columns: 1fr;
  }
}
</style>
