// @vitest-environment jsdom
/**
 * 输入框候选下拉：无候选零回归、有候选可点选、点选回填显示文本。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus, { ElAutocomplete } from "element-plus";
import FieldInputSuggest from "../src/fields/FieldInputSuggest.vue";

function mountInput(props: Record<string, unknown> = {}) {
  return mount(FieldInputSuggest, {
    props,
    global: { plugins: [ElementPlus] },
  });
}

describe("输入框：多条数据作为下拉候选", () => {
  it("没配候选时仍是普通 ElInput，行为零变化", () => {
    const wrapper = mountInput({ modelValue: "张三", placeholder: "请输入" });

    expect(wrapper.find(".el-autocomplete").exists()).toBe(false);
    expect(wrapper.find(".el-input").exists()).toBe(true);
    expect(wrapper.find("input").element.value).toBe("张三");
  });

  it("配了候选项时切成 el-autocomplete（兼容字符串与选项数组）", () => {
    expect(mountInput({ options: "张三,李四" }).find(".el-autocomplete").exists()).toBe(true);
    expect(
      mountInput({ options: [{ label: "张三/ZS001", value: "1" }] })
        .find(".el-autocomplete")
        .exists(),
    ).toBe(true);
  });

  it("点选候选回填显示文本 label，并抛 change", async () => {
    const wrapper = mountInput({ options: [{ label: "张三/ZS001", value: "1" }] });

    // 浮层在 jsdom 里不模拟，直接触发 el-autocomplete 的 select 事件
    wrapper.findComponent(ElAutocomplete).vm.$emit("select", { value: "张三/ZS001" });
    await wrapper.vm.$nextTick();

    const updates = wrapper.emitted("update:modelValue") ?? [];
    expect(updates[updates.length - 1]).toEqual(["张三/ZS001"]);
    const changes = wrapper.emitted("change") ?? [];
    expect(changes[changes.length - 1]).toEqual(["张三/ZS001"]);
  });
});
