<script setup lang="ts">
/**
 * 输入框（支持外部数据源候选）。
 *
 * 零回归设计：没配候选时仍渲染原生 ElInput，行为与旧版完全一致；
 * 只有 options 有内容才切成 el-autocomplete。这样「换掉 ElInput 导致
 * maxlength / show-word-limit 等属性静默失效」的风险被限制在配了候选的场景。
 *
 * 候选数据来自统一的选项格式（字符串「名称 值」或数组 {label,value}），
 * 也可以是选项数据源 / 外部数据源写入的 {{options.<节点ID>}} 绑定。
 * 用户点选一条时回填**显示文本 label**（与「显示内容」模板渲染出的文本一致）。
 */
import { computed, useAttrs } from "vue";
import { ElAutocomplete, ElInput } from "element-plus";
import { parseOptions, type OptionItem } from "@x-ac/web-design-core";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: string | OptionItem[];
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
  }>(),
  { clearable: true, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const attrs = useAttrs();
/** 相对视口定位：不受祖先 overflow / transform 影响，避免候选弹层跑到左上角 */
const POPPER_OPTIONS = { strategy: "fixed" as const };
const suggestions = computed(() =>
  parseOptions(props.options)
    .map((item) => item.label)
    .filter(Boolean),
);
const hasCandidates = computed(() => suggestions.value.length > 0);
const value = computed(() => String(props.modelValue ?? ""));

function onInput(next: unknown): void {
  emit("update:modelValue", next);
}

/** el-autocomplete 的 cb 收对象数组，展示字段固定为 value */
function fetchSuggestions(
  query: string,
  callback: (items: Array<Record<string, unknown>>) => void,
): void {
  const keyword = String(query ?? "").trim();
  const matched = keyword
    ? suggestions.value.filter((label) => label.includes(keyword))
    : suggestions.value;
  callback(matched.map((label) => ({ value: label })));
}

/** 点选候选：回填显示文本，并抛 change 让 Schema 里配置的动作照常执行 */
function onSelect(item: Record<string, unknown>): void {
  const label = item?.value == null ? "" : String(item.value);
  emit("update:modelValue", label);
  emit("change", label);
}
</script>

<template>
  <el-autocomplete
    v-if="hasCandidates"
    v-bind="attrs"
    :model-value="value"
    :popper-options="POPPER_OPTIONS"
    :fetch-suggestions="fetchSuggestions"
    :placeholder="props.placeholder"
    :clearable="props.clearable"
    :disabled="props.disabled"
    value-key="value"
    @update:model-value="onInput"
    @select="onSelect"
  />
  <el-input
    v-else
    v-bind="attrs"
    :model-value="value"
    :placeholder="props.placeholder"
    :clearable="props.clearable"
    :disabled="props.disabled"
    @update:model-value="onInput"
  />
</template>
