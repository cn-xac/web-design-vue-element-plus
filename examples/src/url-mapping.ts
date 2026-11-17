/**
 * 「URL 映射测试」面板的核心逻辑（示例层，非引擎代码）。
 *
 * 设计约束：
 * - 不改 core 的任何接口。映射口径刻意与 core/src/data/external.ts 的
 *   renderDisplay / normalizeResponse 保持一致：用 resolveValue 渲染 display 模板，
 *   用 getByPath 取 listField 数组，响应一级字段平铺进作用域。
 * - 只依赖发布版 core 1.0.0 也导出的 resolveValue / getByPath（表达式引擎），
 *   因此 dev（本地源码）与 build（发布版）两条链路都能跑。
 * - 请求用原生 fetch + AbortController，覆盖成功 / 失败 / 超时 / 格式异常四态。
 */
import { getByPath, resolveValue } from "@x-ac/web-design-core";

export type MappingShape = "form" | "select";

export interface MappingConfig {
  /** display 模板，如 {{data.name}} · {{data.deptName}} */
  display: string;
  /** 从响应里取数组的字段（如 list）；空表示响应本身即数据 */
  listField: string;
  /** 归一化形态 */
  shape: MappingShape;
  /** 选项形态的 label 字段 */
  labelField: string;
  /** 选项形态的 value 字段 */
  valueField: string;
}

export type RequestPhase = "idle" | "loading" | "success" | "http-error" | "timeout" | "format-error" | "network-error";

export interface MappingResult {
  /** 原始响应解析后的数据 */
  raw: unknown;
  /** 取出的数组（有 listField 时） */
  rows: unknown[];
  /** form 形态：模板渲染出的文本 */
  text: string;
  /** select 形态：映射出的选项 */
  options: Array<{ label: string; value: string }>;
}

export interface MappingOutcome {
  phase: RequestPhase;
  /** HTTP 状态码；网络错误 / 超时时为 null */
  status: number | null;
  /** 耗时毫秒 */
  elapsed: number;
  /** 展示给用户的状态说明 */
  message: string;
  /** 原始响应文本（失败时是错误体 / 异常信息） */
  rawText: string;
  /** 成功且可映射时的结果 */
  mapped: MappingResult | null;
}

/** 与 core renderDisplay 同构：作用域 = 页面 scope + data + 响应一级字段平铺 */
function renderDisplay(template: string, data: unknown, scope: Record<string, unknown>): string {
  const ctx: Record<string, unknown> = { ...scope, data };
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === "data") continue;
      ctx[key] = value;
    }
  }
  const out = resolveValue(template, ctx);
  return out === null || out === undefined ? "" : String(out);
}

/** 与 core extractRows 同构：有 listField 先取数组；非数组（单对象）包成一条 */
function extractRows(raw: unknown, listField: string): unknown[] {
  let list: unknown = raw;
  if (listField && raw && typeof raw === "object") {
    const hit = getByPath(raw as Record<string, unknown>, listField);
    if (hit !== undefined) list = hit;
  }
  if (Array.isArray(list)) return list;
  return list === undefined || list === null ? [] : [list];
}

/** 对已解析的响应做映射，返回与运行时同构的结果 */
export function mapResponse(
  raw: unknown,
  config: MappingConfig,
  scope: Record<string, unknown>,
): MappingResult {
  const rows = extractRows(raw, config.listField);
  const template = config.display.trim();

  if (config.shape === "select") {
    const labelField = config.labelField || "label";
    const valueField = config.valueField || labelField;
    const options = rows.map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const label = template ? renderDisplay(template, item, scope) : String(getByPath(record, labelField) ?? "");
      const value = String(getByPath(record, valueField) ?? "") || label;
      return { label, value };
    });
    return { raw, rows, text: "", options };
  }

  // form 形态：有模板渲染模板；无模板则展示原始数据文本（等价「原样写入」）
  let target: unknown = raw;
  if (config.listField && raw && typeof raw === "object") {
    const hit = getByPath(raw as Record<string, unknown>, config.listField);
    if (hit !== undefined) target = hit;
  }
  if (Array.isArray(target)) target = target[0] ?? {};
  const text = template
    ? renderDisplay(template, target, scope)
    : raw === null || raw === undefined
      ? ""
      : typeof raw === "object"
        ? JSON.stringify(raw, null, 2)
        : String(raw);
  return { raw, rows, text, options: [] };
}

export interface FetchAndMapOptions extends MappingConfig {
  url: string;
  /** 超时毫秒；<=0 表示不超时 */
  timeout: number;
  /** display 模板里可引用的页面 scope（示例里传空对象即可） */
  scope?: Record<string, unknown>;
}

/**
 * 发起请求 + 映射，返回统一结果对象（不抛错，四态都收敛到 outcome）。
 */
export async function fetchAndMap(options: FetchAndMapOptions): Promise<MappingOutcome> {
  const started = Date.now();
  const elapsed = (): number => Date.now() - started;
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (options.timeout > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeout);
  }

  const { url, timeout: _timeout, scope, ...config } = options;
  void _timeout;

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        phase: "http-error",
        status: res.status,
        elapsed: elapsed(),
        message: `HTTP ${res.status} ${res.statusText}`.trim(),
        rawText: body,
        mapped: null,
      };
    }

    // 先读文本再手动 JSON.parse：能同时演示「格式异常」并保留原始文本用于展示
    const text = await res.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (parseError) {
      return {
        phase: "format-error",
        status: res.status,
        elapsed: elapsed(),
        message: `返回内容不是合法 JSON：${(parseError as Error).message}`,
        rawText: text,
        mapped: null,
      };
    }

    const mapped = mapResponse(raw, config, scope ?? {});
    return {
      phase: "success",
      status: res.status,
      elapsed: elapsed(),
      message: `请求成功 · ${res.status}`,
      rawText: JSON.stringify(raw, null, 2),
      mapped,
    };
  } catch (error) {
    if (timedOut || (error as Error)?.name === "AbortError") {
      return {
        phase: "timeout",
        status: null,
        elapsed: elapsed(),
        message: `请求超时（${options.timeout}ms）已中断`,
        rawText: "",
        mapped: null,
      };
    }
    return {
      phase: "network-error",
      status: null,
      elapsed: elapsed(),
      message: `网络错误：${(error as Error)?.message ?? String(error)}`,
      rawText: "",
      mapped: null,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
