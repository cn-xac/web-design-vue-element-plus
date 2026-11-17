/**
 * 外部数据源示例的本地 mock。
 *
 * 示例站是纯静态站、没有后端。这里在启动时拦截 globalThis.fetch：
 * 命中 /mock/api/ 前缀的请求直接返回 src/mock/external-data.json 里的数据，
 * 其它请求原样透传。core 请求层的默认 fetch 适配器走的就是 globalThis.fetch，
 * 因此无需改动引擎、也不依赖任何后端即可让「外部数据源」示例真实跑起来。
 */
import payload from "./external-data.json";

/** 示例接口地址：schema.ts 的 externalSources.url 直接引用，避免两处写字符串 */
export const EXTERNAL_API = {
  departments: "/mock/api/departments",
  employees: "/mock/api/employees",
  profile: "/mock/api/profile",
  orderDetails: "/mock/api/order-details",
} as const;

/**
 * 「URL 映射测试」专用端点：四个场景各一个，供示例面板演示请求状态与异常处理。
 * 与 EXTERNAL_API 的既有端点互不干扰，保持现有映射示例不变。
 */
export const TEST_API = {
  /** 成功：200 + 平铺对象，display 模板可取 {{data.*}} */
  success: "/mock/api/test/success",
  /** 失败：500 + JSON 错误体 */
  failure: "/mock/api/test/failure",
  /** 超时：延迟 8s（面板默认 2s 超时先 abort） */
  timeout: "/mock/api/test/timeout",
  /** 数据格式异常：200 但返回 HTML 文本，非 JSON */
  badFormat: "/mock/api/test/bad-format",
} as const;

const ROUTES: Record<string, unknown> = {
  [EXTERNAL_API.departments]: payload.departments,
  [EXTERNAL_API.employees]: payload.employees,
  [EXTERNAL_API.profile]: payload.profile,
  [EXTERNAL_API.orderDetails]: payload.orderDetails,
};

/** 成功端点返回的数据（复用 profile 结构，字段可直接做 display 映射） */
const TEST_SUCCESS = {
  code: 0,
  message: "ok",
  name: "张三",
  deptName: "技术中心",
  title: "高级前端工程师",
  mobile: "13800000001",
};

/** 可被 AbortSignal 取消的延时；客户端超时 abort 时抛 AbortError，避免 mock 空转 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("已取消", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException("已取消", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const FLAG = "__xacExternalMockInstalled";

/** 从 RequestInfo 里取出用于匹配的 pathname（去掉 query 与 origin） */
function toPath(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.pathname
        : input.url;
  return raw.split("?")[0].replace(/^https?:\/\/[^/]+/, "") || "/";
}

/** 启动时安装一次；重复调用不会叠加拦截 */
export function installExternalMock(): void {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  if (g[FLAG]) return;
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = toPath(input);

    // URL 映射测试端点：优先匹配，独立于既有外部数据源路由
    if (path === TEST_API.success) return json(TEST_SUCCESS);
    if (path === TEST_API.failure) {
      return json({ code: 500, message: "模拟服务端异常" }, 500);
    }
    if (path === TEST_API.timeout) {
      await delay(8000, init?.signal ?? undefined);
      return json(TEST_SUCCESS);
    }
    if (path === TEST_API.badFormat) {
      // 200 但 content-type 是 text/html：JSON.parse 会失败，用于演示「数据格式异常」
      return new Response("<!doctype html><html><body>not json</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (Object.prototype.hasOwnProperty.call(ROUTES, path)) {
      return json(ROUTES[path]);
    }
    return original(input, init);
  };
  g[FLAG] = true;
}
