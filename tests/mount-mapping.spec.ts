// @vitest-environment jsdom
/**
 * 容器挂载映射回归：JSON 节点片段挂到指定容器后，与固定节点一起渲染，
 * 且片段里的 {{form.xxx}} 绑定能从表单数据回填。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { NodeSchema, PageSchema } from "@x-ac/web-design-core";
import { COMPONENT_MAP } from "../src/components";
import { elementPlusMaterials } from "../src/materials";

const adapter = { name: "ep-mount", components: COMPONENT_MAP, materials: elementPlusMaterials };

const HOST: PageSchema = {
  schemaVersion: "1.3.0",
  id: "page_mount",
  type: "page",
  meta: { title: "挂载" },
  state: {},
  children: [
    { id: "mm_fixed", component: "ec-input", props: { label: "固定字段" } },
    { id: "target_card", component: "ec-card", props: { title: "容器 A" }, children: [] },
    { id: "target_container", component: "ec-container", props: {}, children: [] },
  ],
};

const INJECT: NodeSchema[] = [
  { id: "mount_user", component: "ec-input", props: { label: "用户名", modelValue: "{{form.mount_user}}" } },
  { id: "mount_show", component: "ec-text", props: { text: "回显：{{form.mount_user}}" } },
];

function mountInto(host: PageSchema, id: string, injected: NodeSchema[]): PageSchema {
  const clone = JSON.parse(JSON.stringify(host)) as PageSchema;
  const walk = (nodes: NodeSchema[]): void => {
    for (const node of nodes ?? []) {
      if (node.id === id) node.children = [...(node.children ?? []), ...injected];
      if (node.children?.length) walk(node.children);
    }
  };
  walk(clone.children ?? []);
  return clone;
}

function render(id: string) {
  const page = mountInto(HOST, id, INJECT);
  return mount(SchemaRenderer, {
    props: { page, data: { form: { mount_user: "王五" } }, adapter },
    global: { plugins: [ElementPlus] },
  });
}

describe("容器挂载映射：JSON 片段注入指定容器", () => {
  it("固定节点 + 注入节点同时渲染", () => {
    const html = render("target_card").html();
    expect(html).toContain("固定字段");
    expect(html).toContain("容器 A");
    expect(html).toContain("用户名");
  });

  it("注入节点的 {{form.xxx}} 从表单数据回填", () => {
    const wrapper = render("target_card");
    const values = wrapper.findAll("input").map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain("王五");
    expect(wrapper.text()).toContain("回显：王五");
  });

  it("切换目标容器：节点挂到新容器，原容器不再含注入节点", () => {
    const page = mountInto(HOST, "target_container", INJECT);
    const card = page.children?.find((n) => n.id === "target_card");
    const container = page.children?.find((n) => n.id === "target_container");
    expect(card?.children ?? []).toHaveLength(0);
    expect(container?.children ?? []).toHaveLength(INJECT.length);
    const html = render("target_container").html();
    expect(html).toContain("用户名");
  });
});
