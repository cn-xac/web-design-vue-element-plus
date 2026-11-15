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

const ROUTES: Record<string, unknown> = {
  [EXTERNAL_API.departments]: payload.departments,
  [EXTERNAL_API.employees]: payload.employees,
  [EXTERNAL_API.profile]: payload.profile,
  [EXTERNAL_API.orderDetails]: payload.orderDetails,
};

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
    if (Object.prototype.hasOwnProperty.call(ROUTES, path)) {
      return new Response(JSON.stringify(ROUTES[path]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return original(input, init);
  };
  g[FLAG] = true;
}
