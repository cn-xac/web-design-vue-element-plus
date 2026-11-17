import { afterEach, describe, expect, it, vi } from "vitest";
import { mapResponse, type MappingConfig } from "../examples/src/url-mapping";
import { fetchAndMap } from "../examples/src/url-mapping";

/** 结束时恢复 fetch，避免污染其它用例（ forks 池共享全局） */
const nativeFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

const FORM_CFG: MappingConfig = {
  display: "{{data.name}} · {{data.deptName}}",
  listField: "",
  shape: "form",
  labelField: "name",
  valueField: "deptName",
};

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("mapResponse：与 core display 映射同构", () => {
  it("form 形态：响应一级字段平铺进 data，display 模板取到值", () => {
    const result = mapResponse({ name: "张三", deptName: "技术中心" }, FORM_CFG, {});
    expect(result.text).toBe("张三 · 技术中心");
    expect(result.rows).toHaveLength(1);
  });

  it("form 形态：listField 取数组后只渲染首条", () => {
    const cfg = { ...FORM_CFG, listField: "list" };
    const result = mapResponse(
      { list: [{ name: "张三", deptName: "技术中心" }, { name: "李四", deptName: "产品中心" }] },
      cfg,
      {},
    );
    expect(result.rows).toHaveLength(2);
    expect(result.text).toBe("张三 · 技术中心");
  });

  it("select 形态：逐项映射 label/value，display 模板决定 label", () => {
    const cfg: MappingConfig = { ...FORM_CFG, shape: "select", listField: "list", display: "{{data.name}}" };
    const result = mapResponse(
      { list: [{ name: "张三", deptName: "技术中心" }, { name: "李四", deptName: "产品中心" }] },
      cfg,
      {},
    );
    expect(result.options).toEqual([
      { label: "张三", value: "技术中心" },
      { label: "李四", value: "产品中心" },
    ]);
  });
});

describe("fetchAndMap：请求四态", () => {
  it("成功：phase=success，带状态码与映射结果", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ name: "张三", deptName: "技术中心" })) as never;
    const out = await fetchAndMap({ ...FORM_CFG, url: "/mock/api/test/success", timeout: 1000 });
    expect(out.phase).toBe("success");
    expect(out.status).toBe(200);
    expect(out.mapped?.text).toBe("张三 · 技术中心");
  });

  it("失败：非 2xx 收敛为 http-error，保留错误体", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ code: 500, message: "模拟服务端异常" }, 500)) as never;
    const out = await fetchAndMap({ ...FORM_CFG, url: "/mock/api/test/failure", timeout: 1000 });
    expect(out.phase).toBe("http-error");
    expect(out.status).toBe(500);
    expect(out.rawText).toContain("模拟服务端异常");
    expect(out.mapped).toBeNull();
  });

  it("超时：abort 后收敛为 timeout，不误报网络错误", async () => {
    globalThis.fetch = vi.fn((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("已取消", "AbortError"));
        });
      }),
    ) as never;
    const out = await fetchAndMap({ ...FORM_CFG, url: "/mock/api/test/timeout", timeout: 20 });
    expect(out.phase).toBe("timeout");
    expect(out.status).toBeNull();
    expect(out.mapped).toBeNull();
  });

  it("数据格式异常：200 但非 JSON，收敛为 format-error 并保留原文", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ) as never;
    const out = await fetchAndMap({ ...FORM_CFG, url: "/mock/api/test/bad-format", timeout: 1000 });
    expect(out.phase).toBe("format-error");
    expect(out.status).toBe(200);
    expect(out.rawText).toContain("not json");
    expect(out.mapped).toBeNull();
  });

  it("网络错误：fetch 抛错收敛为 network-error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as never;
    const out = await fetchAndMap({ ...FORM_CFG, url: "http://unreachable", timeout: 1000 });
    expect(out.phase).toBe("network-error");
    expect(out.message).toContain("Failed to fetch");
  });
});
