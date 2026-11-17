<script setup lang="ts">
/**
 * 「映射测试」页：URL 获取数据 → 标签内容映射的端到端测试台。
 *
 * 场景：输入/选择 URL → 发起请求 → 观察请求状态（成功 / 失败 / 超时 / 格式异常）→
 * 查看原始返回数据 → 查看按 display 模板 + listField 做的内容映射结果。
 *
 * 映射逻辑全部来自 ./url-mapping，口径与 core 的 renderDisplay / normalizeResponse 一致；
 * 本组件只负责表单与结果展示，不改引擎、不碰现有外部数据源接口。
 */
import { computed, reactive, ref } from "vue";
import { TEST_API } from "../mock/install-mock";
import {
  fetchAndMap,
  type FetchAndMapOptions,
  type MappingOutcome,
  type MappingShape,
  type RequestPhase,
} from "../url-mapping";

/** 模板里不能直接写 {{}} 字面量（会被编译器当插值），放脚本常量 */
const DISPLAY_HINT = "{{data.字段}}";

const PRESETS: Array<{ label: string; url: string; hint: string }> = [
  { label: "成功", url: TEST_API.success, hint: "200 + 平铺对象，display 模板可取 {{data.*}}" },
  { label: "失败", url: TEST_API.failure, hint: "500 服务端异常" },
  { label: "超时", url: TEST_API.timeout, hint: "8s 延迟，面板 2s 超时中断" },
  { label: "格式异常", url: TEST_API.badFormat, hint: "200 但返回 HTML，非 JSON" },
];

const form = reactive({
  url: TEST_API.success as string,
  timeout: 2000,
  display: "{{data.name}} · {{data.deptName}}",
  listField: "",
  shape: "form" as MappingShape,
  labelField: "name",
  valueField: "deptName",
});

const outcome = ref<MappingOutcome | null>(null);
const running = computed(() => outcome.value?.phase === "loading");

const PHASE_LABEL: Record<RequestPhase, string> = {
  idle: "未发起",
  loading: "请求中…",
  success: "成功",
  "http-error": "请求失败",
  timeout: "超时",
  "format-error": "数据格式异常",
  "network-error": "网络错误",
};
const PHASE_CLASS: Record<RequestPhase, string> = {
  idle: "idle",
  loading: "loading",
  success: "success",
  "http-error": "error",
  timeout: "error",
  "format-error": "error",
  "network-error": "error",
};

function usePreset(preset: { url: string; hint: string }): void {
  form.url = preset.url;
  // 换场景时把结果指向该场景的提示，避免上一次结果误导
  outcome.value = {
    phase: "idle",
    status: null,
    elapsed: 0,
    message: preset.hint,
    rawText: "",
    mapped: null,
  };
}

async function run(): Promise<void> {
  if (!form.url.trim() || running.value) return;
  const options: FetchAndMapOptions = {
    url: form.url.trim(),
    timeout: Math.max(0, Number(form.timeout) || 0),
    display: form.display,
    listField: form.listField,
    shape: form.shape,
    labelField: form.labelField,
    valueField: form.valueField,
    scope: {},
  };
  outcome.value = {
    phase: "loading",
    status: null,
    elapsed: 0,
    message: "请求中…",
    rawText: "",
    mapped: null,
  };
  outcome.value = await fetchAndMap(options);
}
</script>

<template>
  <section class="mapdemo demo__panel--mappingtest">
    <div class="mapdemo__config">
      <h3 class="mapdemo__title">URL 映射测试台</h3>
      <p class="mapdemo__desc">
        输入或选择 URL → 发起请求 → 查看请求状态、原始返回与内容映射结果。映射口径与运行时
        <code>display</code> 模板一致，不改现有外部数据源接口。
      </p>

      <div class="mapdemo__presets">
        <el-button
          v-for="preset in PRESETS"
          :key="preset.url"
          size="small"
          :type="form.url === preset.url ? 'primary' : undefined"
          @click="usePreset(preset)"
        >
          {{ preset.label }}
        </el-button>
      </div>

      <label class="mapdemo__label">请求地址 URL</label>
      <el-input v-model="form.url" size="small" placeholder="/mock/api/test/success 或任意 http(s) 地址" />

      <div class="mapdemo__row">
        <div class="mapdemo__field">
          <label class="mapdemo__label">超时（ms，0=不限）</label>
          <el-input-number v-model="form.timeout" :min="0" :step="500" size="small" controls-position="right" />
        </div>
        <div class="mapdemo__field">
          <label class="mapdemo__label">归一化形态</label>
          <el-select v-model="form.shape" size="small">
            <el-option label="form（内容文本）" value="form" />
            <el-option label="select（选项映射）" value="select" />
          </el-select>
        </div>
      </div>

      <label class="mapdemo__label">display 模板（{{ DISPLAY_HINT }}）</label>
      <el-input v-model="form.display" size="small" placeholder="{{data.name}} · {{data.deptName}}" />

      <div class="mapdemo__row">
        <div class="mapdemo__field">
          <label class="mapdemo__label">列表字段 listField</label>
          <el-input v-model="form.listField" size="small" placeholder="留空=响应即数据" />
        </div>
        <template v-if="form.shape === 'select'">
          <div class="mapdemo__field">
            <label class="mapdemo__label">label 字段</label>
            <el-input v-model="form.labelField" size="small" />
          </div>
          <div class="mapdemo__field">
            <label class="mapdemo__label">value 字段</label>
            <el-input v-model="form.valueField" size="small" />
          </div>
        </template>
      </div>

      <el-button type="primary" :loading="running" class="mapdemo__run" @click="run">
        {{ running ? "请求中…" : "发起请求" }}
      </el-button>
    </div>

    <div class="mapdemo__result">
      <div class="mapdemo__status" :data-phase="PHASE_CLASS[outcome?.phase ?? 'idle']">
        <span class="mapdemo__status-dot" />
        <strong>{{ PHASE_LABEL[outcome?.phase ?? "idle"] }}</strong>
        <span v-if="outcome && outcome.status !== null" class="mapdemo__status-meta">HTTP {{ outcome.status }}</span>
        <span v-if="outcome && outcome.elapsed" class="mapdemo__status-meta">{{ outcome.elapsed }}ms</span>
        <span class="mapdemo__status-msg">{{ outcome?.message ?? "选择场景或输入 URL 后点击发起请求" }}</span>
      </div>

      <div class="mapdemo__grid">
        <div class="mapdemo__cell">
          <h4 class="mapdemo__cell-title">原始返回数据</h4>
          <pre class="mapdemo__code">{{ outcome?.rawText || "（暂无）" }}</pre>
        </div>
        <div class="mapdemo__cell">
          <h4 class="mapdemo__cell-title">映射结果</h4>
          <template v-if="outcome?.mapped">
            <div v-if="form.shape === 'form'" class="mapdemo__mapped-text">
              {{ outcome.mapped.text || "（模板未取到值）" }}
            </div>
            <pre v-else class="mapdemo__code">{{ JSON.stringify(outcome.mapped.options, null, 2) }}</pre>
            <p class="mapdemo__cell-note">
              取到 {{ outcome.mapped.rows.length }} 条数据 ·
              {{ form.shape === "form" ? "form 形态按模板渲染首条" : "select 形态逐项映射 label/value" }}
            </p>
          </template>
          <pre v-else class="mapdemo__code">（请求未成功，无映射结果）</pre>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mapdemo {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.mapdemo__config,
.mapdemo__result {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 18px;
  overflow: auto;
}
.mapdemo__config {
  width: 380px;
  flex: 0 0 380px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mapdemo__result {
  flex: 1;
  min-width: 0;
}
.mapdemo__title {
  margin: 0;
  font-size: 16px;
  color: #1d2129;
}
.mapdemo__desc {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.7;
  color: #86909c;
}
.mapdemo__desc code {
  color: #165dff;
}
.mapdemo__presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mapdemo__label {
  font-size: 12px;
  font-weight: 600;
  color: #4e5969;
  margin-top: 4px;
}
.mapdemo__row {
  display: flex;
  gap: 8px;
}
.mapdemo__field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mapdemo__run {
  margin-top: 8px;
  align-self: flex-start;
}
.mapdemo__status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  font-size: 13px;
}
.mapdemo__status[data-phase="success"] {
  background: #f0fdf4;
  border-color: #b7ebc8;
  color: #0a7a3d;
}
.mapdemo__status[data-phase="error"] {
  background: #fef0f0;
  border-color: #fbc4c4;
  color: #c0392b;
}
.mapdemo__status[data-phase="loading"] {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #165dff;
}
.mapdemo__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 8px;
}
.mapdemo__status-meta {
  font-size: 11px;
  opacity: 0.8;
}
.mapdemo__status-msg {
  color: #86909c;
  font-size: 12px;
}
.mapdemo__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 14px;
}
.mapdemo__cell {
  min-width: 0;
}
.mapdemo__cell-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
}
.mapdemo__code {
  margin: 0;
  padding: 10px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 360px;
  overflow: auto;
  color: #1d2129;
}
.mapdemo__mapped-text {
  min-height: 60px;
  padding: 14px;
  background: #f0fdf4;
  border: 1px solid #b7ebc8;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #0a7a3d;
  line-height: 1.6;
}
.mapdemo__cell-note {
  margin: 8px 0 0;
  font-size: 11px;
  color: #86909c;
}
@media (max-width: 960px) {
  .mapdemo {
    flex-direction: column;
  }
  .mapdemo__config {
    width: auto;
    flex: 0 0 auto;
  }
  .mapdemo__grid {
    grid-template-columns: 1fr;
  }
}
</style>
