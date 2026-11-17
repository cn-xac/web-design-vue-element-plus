<script setup lang="ts">
/**
 * 「映射测试」工作台：页内子 tab 把三块能力分开，避免上下堆叠把内容压扁。
 * - 四态测试：URL 取数的成功/失败/超时/格式异常 + 内容映射；
 * - 完整实例：JSON 解析成页面（含各种容器）+ 表单数据回填；
 * - 构建与渲染：固定构建 vs 编辑 JSON 实时渲染对比。
 */
import { ref } from "vue";
import UrlMappingPanel from "./UrlMappingPanel.vue";
import SchemaPageDemo from "./SchemaPageDemo.vue";
import BuildRenderDemo from "./BuildRenderDemo.vue";
import MountMappingDemo from "./MountMappingDemo.vue";

const tab = ref("states");
</script>

<template>
  <div class="workbench">
    <el-tabs v-model="tab" class="workbench__tabs">
      <el-tab-pane label="四态测试" name="states">
        <UrlMappingPanel />
      </el-tab-pane>
      <el-tab-pane label="完整实例" name="full">
        <SchemaPageDemo />
      </el-tab-pane>
      <el-tab-pane label="构建与渲染" name="build">
        <BuildRenderDemo />
      </el-tab-pane>
      <el-tab-pane label="容器挂载映射" name="mount">
        <MountMappingDemo />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.workbench {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 0 16px 16px;
}
/* Grid 比 flex 更确定：auto 行放表头，minmax(0,1fr) 行吃掉剩余高度 */
.workbench__tabs {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  flex: 1;
  height: 100%;
  min-height: 0;
  width: 100%;
}
.workbench__tabs :deep(.el-tabs__header) {
  margin: 0 0 12px;
}
/* content 占满第二行；pane 再撑满 content，子组件根 height:100% 才能生效 */
.workbench__tabs :deep(.el-tabs__content) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.workbench__tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
