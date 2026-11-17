// @vitest-environment jsdom
/**
 * 完整实例回归：URL 返回的 Schema JSON 能否被真实渲染器解析成页面（含各种容器）
 * 并把 Schema.state.form 的表单数据回填到控件。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { PageSchema } from "@x-ac/web-design-core";
import { COMPONENT_MAP } from "../src/components";
import { elementPlusMaterials } from "../src/materials";
import schemaPage from "../examples/src/mock/schema-page.json";

const adapter = { name: "ep-schema-page", components: COMPONENT_MAP, materials: elementPlusMaterials };

function render() {
  return mount(SchemaRenderer, {
    props: {
      page: schemaPage as unknown as PageSchema,
      // 表单数据来自同一份 Schema 的 state.form，模拟示例面板的传法
      data: (schemaPage as unknown as PageSchema).state as Record<string, unknown>,
      adapter,
    },
    global: { plugins: [ElementPlus] },
  });
}

describe("完整实例：JSON → 页面（含各种容器）+ 表单数据映射", () => {
  it("容器：卡片 / 页签 / 子表单 都渲染出来", () => {
    const html = render().html();
    expect(html).toContain("卡片容器"); // ec-card title
    expect(html).toContain("页签一"); // ec-tabs
    expect(html).toContain("子表单容器"); // ec-subform label
  });

  it("表单数据：state.form 的值回填到控件", () => {
    const wrapper = render();
    const inputs = wrapper.findAll("input");
    const values = inputs.map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain("李四"); // sp_name 自动绑定 form.sp_name
    // slice：select 在 jsdom 下不把选中项渲染进 text()，改为校验其它控件的 value
    expect(values).toContain("5"); // sp_years
    expect(values).toContain("2023-06-15"); // sp_join
  });

  it("子表单：数组数据展开成多行并回填 value", () => {
    const wrapper = render();
    const values = wrapper.findAll("input").map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain("无线鼠标");
    expect(values).toContain("笔记本支架");
    expect(values).toContain("2"); // sp_qty
  });
});
