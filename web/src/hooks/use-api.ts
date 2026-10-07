"use client";

import * as React from "react";

import { ApiError } from "@/lib/api";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  /** 首次加载（尚无数据） */
  loading: boolean;
  /** 手动/依赖变化触发的刷新（已有旧数据） */
  refreshing: boolean;
}

/**
 * 极简数据请求 Hook：自动处理 loading / error / 竞态 / 手动刷新。
 *
 * @param fetcher 数据获取函数（内部使用 ref，无需 useCallback 包裹）
 * @param key     依赖标识，变化时自动重新请求（如 `devices-1-online-关键词`）
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  key: string | number = "default",
) {
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = React.useState<QueryState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  });

  const requestIdRef = React.useRef(0);

  const run = React.useCallback(async (mode: "initial" | "refresh") => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({
      ...prev,
      error: null,
      loading: mode === "initial" && prev.data === null,
      refreshing: true,
    }));

    try {
      const result = await fetcherRef.current();
      if (requestId !== requestIdRef.current) return;
      setState({ data: result, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "请求失败，请稍后重试";
      setState((prev) => ({
        data: prev.data,
        error: message,
        loading: false,
        refreshing: false,
      }));
    }
  }, []);

  React.useEffect(() => {
    void run("initial");
  }, [key, run]);

  const refresh = React.useCallback(() => run("refresh"), [run]);

  const setData = React.useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setState((prev) => ({
        ...prev,
        data:
          typeof updater === "function"
            ? (updater as (prev: T | null) => T | null)(prev.data)
            : updater,
      }));
    },
    [],
  );

  return { ...state, refresh, refetch: refresh, setData };
}

/** 处理「提交类」请求的 pending 状态 */
export function useApiMutation<Args extends unknown[], Result>(
  mutation: (...args: Args) => Promise<Result>,
) {
  const mutationRef = React.useRef(mutation);
  mutationRef.current = mutation;

  const [pending, setPending] = React.useState(false);

  const mutate = React.useCallback(async (...args: Args): Promise<Result> => {
    setPending(true);
    try {
      return await mutationRef.current(...args);
    } finally {
      setPending(false);
    }
  }, []);

  return { mutate, pending };
}

/** 请求失败时统一取出后端 message */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}
