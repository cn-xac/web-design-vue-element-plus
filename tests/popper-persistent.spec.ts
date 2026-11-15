// @vitest-environment jsdom
/**
 * popper 类型字段（下拉 / 树选择 / 级联 / 输入候选）的弹层定位与生命周期约定。
 *
 * 1. persistent=false：下拉 DOM 不常驻。组件若先在 display:none 的页签里挂载，
 *    常驻弹层会在首次测量时锁死 0,0，打开后跑到左上角；关闭后每次打开重建并重新测量。
 * 2. popper-options.strategy=fixed：以视口为参照定位，不受祖先 overflow / transform 影响。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus, { ElAutocomplete, ElCascader, ElSelect, ElTreeSelect } from "element-plus";
import FieldSelect from "../src/fields/FieldSelect.vue";
import FieldTreeSelect from "../src/fields/FieldTreeSelect.vue";
import FieldCascader from "../src/fields/FieldCascader.vue";
import FieldInputSuggest from "../src/fields/FieldInputSuggest.vue";

const global = { plugins: [ElementPlus] };
const FIXED = { strategy: "fixed" };

describe("popper 类型字段：弹层跟随元素，不会锁死左上角", () => {
  it("下拉选择", () => {
    const wrapper = mount(FieldSelect, { props: { options: "A,B" }, global });
    const inner = wrapper.findComponent(ElSelect);
    expect(inner.props("persistent")).toBe(false);
    expect(inner.props("popperOptions")).toMatchObject(FIXED);
  });

  it("树选择", () => {
    const wrapper = mount(FieldTreeSelect, { props: { options: "A/B" }, global });
    const inner = wrapper.findComponent(ElTreeSelect);
    expect(inner.props("persistent")).toBe(false);
    expect(inner.props("popperOptions")).toMatchObject(FIXED);
  });

  it("级联选择", () => {
    const wrapper = mount(FieldCascader, { props: { options: "A/B" }, global });
    // cascader 内部自建 popper 配置、不接受外部 popper-options，这里只约束 persistent。
    expect(wrapper.findComponent(ElCascader).props("persistent")).toBe(false);
  });

  it("输入框候选（autocomplete）", () => {
    const wrapper = mount(FieldInputSuggest, { props: { options: "张三,李四" }, global });
    const inner = wrapper.findComponent(ElAutocomplete);
    expect(inner.exists()).toBe(true);
    // ElAutocomplete 的 props 类型未暴露 popperOptions，取全量 props 再断言
    const all = inner.props() as Record<string, unknown>;
    expect(all.popperOptions).toMatchObject(FIXED);
  });
});
