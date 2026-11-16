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

type FetchFn = (q: string, cb: (items: Array<{ value: string }>) => void) => void;
/** 取出 el-autocomplete 的 fetch-suggestions（props 键未进公开类型，故走宽泛断言） */
function fetchOf(wrapper: ReturnType<typeof mountInput>): FetchFn {
  const props = wrapper.findComponent(ElAutocomplete).props() as unknown as Record<string, unknown>;
  return props.fetchSuggestions as FetchFn;
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

  it("搜索过滤后只剩一条候选时自动回填（等价点选）", async () => {
    const wrapper = mountInput({
      modelValue: "",
      options: [
        { label: "张三/ZS001", value: "1" },
        { label: "李四/ZS002", value: "2" },
      ],
    });

    // 直接调用 el-autocomplete 的 fetch-suggestions：输入 "张三" 只剩一条匹配
    const fetch = fetchOf(wrapper);
    let shown: Array<{ value: string }> = [];
    fetch("张三", (items) => (shown = items));
    await wrapper.vm.$nextTick();

    expect(shown).toEqual([{ value: "张三/ZS001" }]);
    const updates = wrapper.emitted("update:modelValue") ?? [];
    expect(updates[updates.length - 1]).toEqual(["张三/ZS001"]);
    const changes = wrapper.emitted("change") ?? [];
    expect(changes[changes.length - 1]).toEqual(["张三/ZS001"]);
  });

  it("多条候选匹配时不自动回填，交给用户点选", async () => {
    const wrapper = mountInput({
      modelValue: "",
      options: [
        { label: "张三/ZS001", value: "1" },
        { label: "张三丰/ZS003", value: "3" },
      ],
    });

    const fetch = fetchOf(wrapper);
    fetch("张三", () => {});
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("退格（新值是上次的真前缀）不自动回填，避免无法逐字删除", async () => {
    // 初值与候选不同，确保退格时 value !== 候选；若没有 isDeleting guard 就会被吸附回去
    const wrapper = mountInput({
      modelValue: "李四",
      options: [{ label: "张三/ZS001", value: "1" }],
    });

    const fetch = fetchOf(wrapper);
    // 先输入到接近完整：唯一匹配 → 自动选中，lastQuery 记为完整 label
    fetch("张三/ZS00", () => {});
    await wrapper.vm.$nextTick();
    const afterInput = (wrapper.emitted("update:modelValue") ?? []).length;
    expect(afterInput).toBe(1);

    // 再退格到前缀：新值是上次的真前缀 → 不自动吸附
    fetch("张三/ZS0", () => {});
    await wrapper.vm.$nextTick();
    expect((wrapper.emitted("update:modelValue") ?? []).length).toBe(afterInput);
  });
});
