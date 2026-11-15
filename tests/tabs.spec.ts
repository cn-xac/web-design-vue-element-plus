// @vitest-environment jsdom
/**
 * 标签页（re0BNA）。
 *
 * 覆盖三条契约：
 * 1. 旧成对字符串继续渲染（向后兼容，老页面不回归）；
 * 2. 结构化标签项 + 自定义 mark 控制默认激活；
 * 3. dataPath 指向的 schema 按协议渲染成内嵌页面（共用宿主 scope）。
 *
 * provide 用宿主组件直接调用，而不是 VTU 的 global.provide ——
 * InjectionKey 是 Symbol，对象键会被 Object.keys 跳过，导致注入静默失效。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import ElementPlus from "element-plus";
import BlockTabs from "../src/blocks/BlockTabs.vue";
import { RENDER_ENV, UI_ADAPTER } from "@x-ac/web-design-vue";
import { COMPONENT_MAP } from "../src/components";
import { elementPlusMaterials } from "../src/materials";

const epAdapter = { name: "ep-test", components: COMPONENT_MAP, materials: elementPlusMaterials };

function mountTabs(
  props: Record<string, unknown>,
  scope: Record<string, unknown> = {},
  design = false,
) {
  const Host = defineComponent({
    setup() {
      provide(UI_ADAPTER, epAdapter as never);
      provide(RENDER_ENV, { scope, mode: design ? "edit" : "view", design });
      return () => h(BlockTabs, props);
    },
  });
  return mount(Host, { global: { plugins: [ElementPlus] } });
}

describe("标签页：向后兼容与结构化标签项", () => {
  it("旧成对字符串仍能渲染多个页签", () => {
    const wrapper = mountTabs({ items: "基本信息:第一页内容,扩展配置:第二页内容" });
    expect(wrapper.findAll(".el-tabs__item")).toHaveLength(2);
    expect(wrapper.text()).toContain("第一页内容");
  });

  it("结构化标签项按 label 渲染", () => {
    const wrapper = mountTabs({
      items: [
        { id: "a", label: "概览", text: "概览内容" },
        { id: "b", label: "详情", text: "详情内容" },
      ],
    });
    const heads = wrapper.findAll(".el-tabs__item");
    expect(heads).toHaveLength(2);
    expect(heads[0].text()).toContain("概览");
    expect(heads[1].text()).toContain("详情");
  });

  it("active 支持自定义标记：mark 匹配即默认激活", async () => {
    const wrapper = mountTabs({
      items: [
        { id: "a", label: "概览", mark: "overview" },
        { id: "b", label: "详情", mark: "detail" },
      ],
      active: "detail",
    });
    await wrapper.vm.$nextTick();
    const heads = wrapper.findAll(".el-tabs__item");
    expect(heads[1].attributes("aria-selected")).toBe("true");
  });
});

describe("标签页：内容按 schema 协议渲染为页面", () => {
  it("dataPath 指向的 schema 渲染出内嵌节点，并共用宿主 scope", async () => {
    const scope = {
      form: {
        detail: {
          children: [{ id: "n1", component: "ec-text", props: { text: "内嵌页面内容" } }],
        },
      },
    };
    const wrapper = mountTabs(
      { items: [{ id: "a", label: "内嵌", dataPath: "form.detail" }] },
      scope,
    );
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("内嵌页面内容");
  });

  it("dataPath 取不到值时降级为文本内容，不白屏", () => {
    const wrapper = mountTabs({
      items: [{ id: "a", label: "缺数据", dataPath: "form.missing", text: "兜底文本" }],
    });
    expect(wrapper.text()).toContain("兜底文本");
  });
});
