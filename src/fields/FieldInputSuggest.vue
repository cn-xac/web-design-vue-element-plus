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
import { computed, useAttrs, watch } from "vue";
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

/**
 * 上一次 fetch 的查询串。用于区分「输入」与「退格」：
 * - 新 query 是上次的真前缀（删掉了尾部字符）= 退格 → 不自动选中，
 *   避免刚回填的完整 label 被吸附回去、无法逐字删除；
 * - 其余（变长、同长替换、清空后重输）= 输入 → 过滤到唯一时允许自动选中。
 * 选中后会被置为完整候选 label，使随后的等长查询不再重复触发。
 */
let lastQuery = "";

// 输入框被清空（含 clear 按钮）时重置基准，否则「清空后重输相同前缀」会被误判为退格，
// 导致过滤到唯一时不再自动选中。
watch(value, (next) => {
  if (!next) lastQuery = "";
});

function onInput(next: unknown): void {
  emit("update:modelValue", next);
}

/** 点选候选：回填显示文本，并抛 change 让 Schema 里配置的动作照常执行 */
function selectLabel(label: string): void {
  emit("update:modelValue", label);
  emit("change", label);
}

/** el-autocomplete 的 cb 收对象数组，展示字段固定为 value */
function fetchSuggestions(
  query: string,
  callback: (items: Array<Record<string, unknown>>) => void,
): void {
  const q = String(query ?? "");
  const keyword = q.trim();
  const matched = keyword
    ? suggestions.value.filter((label) => label.includes(keyword))
    : suggestions.value;

  // 搜索过滤后只剩一条候选，且用户仍在输入（非退格）时，等价于点选自动回填。
  // 多条候选时不自动选，继续交给用户从下拉里点（与历史约定一致）。
  const isDeleting = q.length < lastQuery.length && lastQuery.startsWith(q);
  if (keyword && matched.length === 1 && !isDeleting && value.value !== matched[0]) {
    lastQuery = matched[0]!;
    selectLabel(matched[0]!);
  } else {
    lastQuery = q;
  }
  callback(matched.map((label) => ({ value: label })));
}

/** 点选候选：回填显示文本，并抛 change 让 Schema 里配置的动作照常执行 */
function onSelect(item: Record<string, unknown>): void {
  const label = item?.value == null ? "" : String(item.value);
  selectLabel(label);
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
