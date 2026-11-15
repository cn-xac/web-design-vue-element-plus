<script setup lang="ts">
/**
 * 数字输入。
 *
 * 包一层 ElInputNumber 的唯一目的：把空字符串归一成 undefined。
 * 数字字段在「子表单空行 / 未填值」时可能拿到 ""，
 * 而 ElInputNumber 的 modelValue 只接受 number | null | undefined，
 * 传 "" 会在控制台刷 "Invalid prop: type check failed" 告警。
 */
import { computed } from "vue";
import { ElInputNumber } from "element-plus";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ modelValue?: unknown }>();
const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const value = computed(() => {
  const raw = props.modelValue;
  return raw === "" || raw === null ? undefined : raw;
});
</script>

<template>
  <ElInputNumber
    v-bind="$attrs"
    :model-value="value as never"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
