<script setup lang="ts">
/**
 * 容器数据驱动编辑器（rGjzDs）。
 *
 * 属性面板里 contentPath 字段的编辑器：填 scope 路径（如 form.detail），
 * 运行时把该处的业务 JSON 推导成页面。引擎契约只有 modelValue / update:modelValue，
 * 因此这里只编辑路径本身；contentMode / fieldMap 由物料字段里的普通控件承担。
 */
import { computed } from "vue";

const props = defineProps<{ modelValue?: unknown; field?: unknown }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const value = computed(() => (typeof props.modelValue === "string" ? props.modelValue : ""));

/** 常见路径提示：外部数据源默认写 external.*，表单数据写 form.* */
const suggestions = ["form.", "external.", "page."];

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="jsonpage">
    <input
      class="jsonpage__input"
      type="text"
      :value="value"
      :placeholder="'scope 路径，如 form.detail'"
      :list="'jsonpage-paths'"
      @input="onInput"
    />
    <datalist id="jsonpage-paths">
      <option v-for="item in suggestions" :key="item" :value="item" />
    </datalist>
    <div class="jsonpage__tip">留空则使用拖入的静态节点；填写后运行时把该处 JSON 推导成页面</div>
  </div>
</template>

<style scoped>
.jsonpage {
  width: 100%;
}
.jsonpage__input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 5px;
  background: var(--el-fill-color-blank, #fff);
  color: var(--el-text-color-regular, #303133);
  font-family: inherit;
  font-size: 12px;
}
.jsonpage__input:focus {
  border-color: var(--el-color-primary, #409eff);
  outline: none;
}
.jsonpage__tip {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--el-text-color-secondary, #909399);
}
</style>
