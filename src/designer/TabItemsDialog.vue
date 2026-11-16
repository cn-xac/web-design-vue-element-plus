<script setup lang="ts">
/**
 * 标签项维护弹窗（re0BNA）。
 *
 * 一个可增删改的列表：标题、自定义标记、内容来源（文本 / 绑定数据 / 外部 URL）。
 * 标题支持拖拽排序 —— 排序结果直接决定页签顺序，所以用行下标 splice 搬移即可。
 *
 * 只在「新建」时生成 id；已存在的项沿用原 id，保证拖拽后 key 稳定、输入不失焦。
 */
import { reactive, ref } from "vue";
import { ElButton, ElDialog, ElInput, ElOption, ElSelect } from "element-plus";
import { createTabId, type TabItem } from "@x-ac/web-design-core";

const props = defineProps<{ items: TabItem[] }>();
const emit = defineEmits<{ save: [items: TabItem[]]; close: [] }>();

type ContentKind = "design" | "dataPath" | "url";

const rows = reactive<TabItem[]>(
  props.items.length
    ? props.items.map((item) => ({ ...item, content: item.content ?? "design" }))
    : [{ id: createTabId(), label: "标签一", content: "design" }],
);

const dragIndex = ref(-1);
const overIndex = ref(-1);

function addRow(): void {
  rows.push({ id: createTabId(), label: `标签${rows.length + 1}`, content: "design" });
}

function removeRow(index: number): void {
  rows.splice(index, 1);
}

/* ---------------- 拖拽排序 ---------------- */

function onDragStart(index: number, event: DragEvent): void {
  dragIndex.value = index;
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function onDragOver(index: number, event: DragEvent): void {
  event.preventDefault();
  overIndex.value = index;
}

function onDrop(index: number): void {
  const from = dragIndex.value;
  if (from < 0 || from === index) return;
  const [moved] = rows.splice(from, 1);
  rows.splice(index, 0, moved);
  dragIndex.value = -1;
  overIndex.value = -1;
}

function onDragEnd(): void {
  dragIndex.value = -1;
  overIndex.value = -1;
}

/* ---------------- 内容来源 ---------------- */

function contentKind(row: TabItem): ContentKind {
  if (row.content === "dataPath" || row.content === "url") return row.content;
  // 旧页面可能只有 text/dataPath/url 没有 content，按既有优先级推断
  if (row.dataPath) return "dataPath";
  if (row.url) return "url";
  return "design";
}

/** 三种来源互斥：切换时清掉另外两种，避免残留配置在运行时抢优先级 */
function setKind(row: TabItem, kind: ContentKind): void {
  row.content = kind;
  if (kind === "design") {
    delete row.dataPath;
    delete row.url;
    delete row.method;
    delete row.text;
  } else if (kind === "dataPath") {
    delete row.url;
    delete row.method;
    delete row.text;
    row.dataPath = row.dataPath ?? "";
  } else {
    delete row.dataPath;
    delete row.text;
    row.url = row.url ?? "";
    row.method = row.method ?? "get";
  }
}

function setText(row: TabItem, key: "label" | "mark" | "text" | "dataPath" | "url", value: string): void {
  (row as unknown as Record<string, unknown>)[key] = value;
}

/* ---------------- 保存 ---------------- */

function save(): void {
  const out: TabItem[] = rows
    .map((row) => {
      const item: TabItem = { id: row.id, label: row.label.trim() };
      if (row.mark?.trim()) item.mark = row.mark.trim();
      const kind = contentKind(row);
      item.content = kind;
      if (kind === "dataPath") {
        if (row.dataPath?.trim()) item.dataPath = row.dataPath.trim();
      } else if (kind === "url" && row.url?.trim()) {
        item.url = row.url.trim();
        item.method = row.method ?? "get";
      }
      return item;
    })
    .filter((row) => row.label !== "");

  emit("save", out);
  emit("close");
}
</script>

<template>
  <ElDialog
    :model-value="true"
    title="标签项维护"
    width="820px"
    append-to-body
    @close="emit('close')"
  >
    <div class="tabdlg">
      <div class="tabdlg__head">
        <span class="tabdlg__col tabdlg__col--handle">排序</span>
        <span class="tabdlg__col">标题</span>
        <span class="tabdlg__col">标记</span>
        <span class="tabdlg__col">内容来源</span>
        <span class="tabdlg__col tabdlg__col--content">内容</span>
        <span class="tabdlg__col tabdlg__col--op">操作</span>
      </div>

      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="tabdlg__row"
        :class="{ 'is-drag': dragIndex === index, 'is-over': overIndex === index && dragIndex !== index }"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop(index)"
      >
        <span
          class="tabdlg__handle"
          title="拖拽排序"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragend="onDragEnd"
        >
          ⠿
        </span>

        <ElInput
          size="small"
          placeholder="标签标题"
          :model-value="row.label"
          @update:model-value="(v: string) => setText(row, 'label', v)"
        />
        <ElInput
          size="small"
          placeholder="标记（可选）"
          :model-value="row.mark ?? ''"
          @update:model-value="(v: string) => setText(row, 'mark', v)"
        />

        <ElSelect
          size="small"
          :model-value="contentKind(row)"
          @update:model-value="(v: ContentKind) => setKind(row, v)"
        >
          <ElOption label="设计器内编辑" value="design" />
          <ElOption label="绑定数据" value="dataPath" />
          <ElOption label="外部 URL" value="url" />
        </ElSelect>

        <span v-if="contentKind(row) === 'design'" class="tabdlg__design-tip">在画布里向该页签拖入组件</span>
        <ElInput
          v-else-if="contentKind(row) === 'dataPath'"
          size="small"
          placeholder="如 form.detailSchema"
          :model-value="row.dataPath ?? ''"
          @update:model-value="(v: string) => setText(row, 'dataPath', v)"
        />
        <div v-else class="tabdlg__url">
          <ElSelect
            size="small"
            :model-value="row.method ?? 'get'"
            @update:model-value="(v: string) => (row.method = v === 'post' ? 'post' : 'get')"
          >
            <ElOption label="GET" value="get" />
            <ElOption label="POST" value="post" />
          </ElSelect>
          <ElInput
            size="small"
            placeholder="返回 schema JSON 的地址"
            :model-value="row.url ?? ''"
            @update:model-value="(v: string) => setText(row, 'url', v)"
          />
        </div>

        <ElButton size="small" text type="danger" @click="removeRow(index)">删除</ElButton>
      </div>

      <ElButton size="small" text type="primary" @click="addRow">+ 新增标签项</ElButton>
    </div>

    <template #footer>
      <ElButton size="small" @click="emit('close')">取消</ElButton>
      <ElButton size="small" type="primary" @click="save">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.tabdlg {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tabdlg__head,
.tabdlg__row {
  display: grid;
  grid-template-columns: 36px 1.1fr 0.9fr 104px 1.6fr 56px;
  align-items: center;
  gap: 8px;
}
.tabdlg__head {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 0 2px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.tabdlg__col--handle {
  text-align: center;
}
.tabdlg__col--content {
  padding-left: 2px;
}
.tabdlg__row {
  padding: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}
.tabdlg__row.is-drag {
  opacity: 0.5;
}
.tabdlg__row.is-over {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}
.tabdlg__handle {
  text-align: center;
  cursor: grab;
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  user-select: none;
}
.tabdlg__handle:active {
  cursor: grabbing;
}
.tabdlg__url {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 6px;
}
.tabdlg__design-tip {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  padding-left: 2px;
}
</style>
