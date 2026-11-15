<script setup lang="ts">
/**
 * 标签项字段编辑器（re0BNA）。
 *
 * 属性面板里的「摘要 + 编辑」入口：面板不铺开整个列表，只显示前几项名称，
 * 点开弹窗集中维护（增删改 + 拖拽排序）。保存后通过 update:modelValue 回写
 * 节点的 props.items，由设计器 store 统一落库。
 */
import { computed, ref } from "vue";
import { parseTabItems, type PropField, type TabItem } from "@x-ac/web-design-core";
import TabItemsDialog from "./TabItemsDialog.vue";

const props = defineProps<{ modelValue?: unknown; field?: PropField }>();
const emit = defineEmits<{ "update:modelValue": [value: TabItem[]] }>();

const visible = ref(false);
const items = computed<TabItem[]>(() => parseTabItems(props.modelValue));

const summary = computed(() => {
  const names = items.value.map((item) => item.label).filter(Boolean);
  if (!names.length) return "尚未设置";
  const head = names.slice(0, 3).join("、");
  return names.length > 3 ? `${head} 等 ${names.length} 项` : `${head}（${names.length} 项）`;
});

function save(next: TabItem[]): void {
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="tabitems">
    <button type="button" class="tabitems__btn" @click="visible = true">
      <span class="tabitems__text">{{ summary }}</span>
      <span class="tabitems__edit">编辑…</span>
    </button>
    <TabItemsDialog v-if="visible" :items="items" @save="save" @close="visible = false" />
  </div>
</template>

<style scoped>
.tabitems {
  width: 100%;
}
.tabitems__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  background: var(--el-fill-color-blank);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.tabitems__btn:hover {
  border-color: var(--el-color-primary);
}
.tabitems__text {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tabitems__edit {
  font-size: 11px;
  color: var(--el-color-primary);
  white-space: nowrap;
}
</style>
