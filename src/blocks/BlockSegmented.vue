<script setup lang="ts">
/**
 * 分段控制器。选项用逗号分隔；选中项是展示态，不参与表单数据，
 * 需要收集值请用单选框（radio）。
 */
import { computed, ref } from "vue";
import { parseOptions, type OptionItem } from "@x-ac/web-design-core";

const props = withDefaults(
  defineProps<{
    options?: string | OptionItem[];
    value?: string;
    size?: "large" | "default" | "small";
    block?: boolean;
    disabled?: boolean;
  }>(),
  { options: "日,周,月", value: "", size: "default", block: false, disabled: false },
);

const items = computed(() =>
  parseOptions(props.options).map((item) => ({ label: item.label, value: item.value || item.label })),
);

const current = ref("");
const active = computed(() => {
  // 先按值匹配，再按名称匹配（没配值时值即名称，兼容旧的只写名称的写法）
  const byValue = items.value.findIndex((item) => item.value === props.value);
  if (byValue >= 0) return items.value[byValue]!.value;
  const byLabel = items.value.findIndex((item) => item.label === props.value);
  if (byLabel >= 0) return items.value[byLabel]!.value;
  return current.value || items.value[0]?.value || "";
});
</script>

<template>
  <el-segmented
    :model-value="active"
    :options="items"
    :size="size"
    :block="block"
    :disabled="disabled"
    @update:model-value="(next: unknown) => (current = String(next))"
  />
</template>
