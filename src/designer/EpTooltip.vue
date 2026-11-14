<script setup lang="ts">
/**
 * Element Plus 适配包 · 设计器说明提示。
 *
 * 引擎侧的契约只有一条：接受 `text` prop（说明文案）+ 默认插槽（触发元素）。
 * Element Plus 用的是 `content`，这层差异在这里抹平。
 */
import { ElTooltip } from "element-plus";

withDefaults(defineProps<{ text?: string }>(), { text: "" });
</script>

<template>
  <ElTooltip :content="text" placement="top" :show-after="150" :hide-after="0" :enterable="false">
    <slot />
  </ElTooltip>
</template>
