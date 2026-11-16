// @vitest-environment jsdom
/**
 * 页签内容「设计 → 保存 → 预览」端到端（rGjzDs 预览空白回归）。
 * 用 EP 真实物料 + 真实 SchemaRenderer，复现用户的完整操作路径。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import { compactPage, createRegistry, DesignerStore } from "@x-ac/web-design-core";
import { COMPONENT_MAP } from "../src/components";
import { elementPlusMaterials } from "../src/materials";

function makeStore(): DesignerStore {
  const store = new DesignerStore();
  store.setMaterialCatalog(createRegistry(elementPlusMaterials));
  store.setPage({ schemaVersion: "1.3.0", id: "p", type: "page", children: [] });
  return store;
}

const epAdapter = { name: "ep-preview", components: COMPONENT_MAP, materials: elementPlusMaterials };

describe("页签内容：保存后预览仍渲染", () => {
  it("EP 物料里 tabs 必须声明 paneSlotKey", () => {
    const tabs = elementPlusMaterials.find((m) => m.component === "ec-tabs");
    expect(tabs?.paneSlotKey).toBe("paneId");
  });

  it("新建 tabs → 拖入文本 → 压缩 → 渲染，内容必须出现", () => {
    const store = makeStore();
    store.addNode("ec-tabs", null, "after");
    const tabs = store.getSnapshot().page.children[0];

    const pane = (tabs.children ?? []).find((c) => c.props?.paneId === "tab1");
    expect(pane, "新建 tabs 应自带 pane 容器").toBeTruthy();

    store.addNode("ec-text", pane!.id, "inside");
    // mutatePage 会换新 page 引用，重新取一次
    const tabs2 = store.getSnapshot().page.children[0];
    const pane2 = (tabs2.children ?? []).find((c) => c.props?.paneId === "tab1")!;
    expect(pane2.children?.length, "文本应落进 pane 容器").toBe(1);
    store.updateNodeProp(pane2.children![0].id, "text", "预览应该看到这段文字");

    // 预览链路：save() 内部做 compactPage
    const compact = compactPage(store.getSnapshot().page);
    const compactTabs = compact.children[0];
    expect(compactTabs.children?.map((c) => c.props?.paneId), "压缩后 pane 容器必须保留").toEqual(["tab1", "tab2"]);
    const wrapper = mount(SchemaRenderer, {
      props: { page: compact, adapter: epAdapter },
      global: { plugins: [ElementPlus] },
    });

    expect(wrapper.text()).toContain("预览应该看到这段文字");
  });
});
