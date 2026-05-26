// =====================================================================
// useUserFormulas — 로그인 사용자의 공식 목록 fetch / mutate hook
// ---------------------------------------------------------------------
// · 로그인하지 않았으면 빈 배열 반환 (호출도 안 함)
// · 컴포넌트 마운트 시 1회 fetch
// · refetch() / removeFormula(id) / upsertLocal(formula) 제공
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import AxiosInstance from "../AxiosInstance";

export function isLoggedIn() {
  return !!localStorage.getItem("Token");
}

export default function useUserFormulas() {
  const [formulas, setFormulas] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const refetch = useCallback(async () => {
    if (!isLoggedIn()) {
      setFormulas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await AxiosInstance.get("/invest/formulas/");
      // DRF 가 페이지네이션 켜져 있을 수도/꺼져 있을 수도 있음
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setFormulas(list);
    } catch (e) {
      setError(e?.message || "공식 목록 로드 실패");
      setFormulas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const upsertLocal = useCallback((formula) => {
    setFormulas((prev) => {
      const idx = prev.findIndex((f) => f.id === formula.id);
      if (idx === -1) return [formula, ...prev];
      const next = prev.slice();
      next[idx] = formula;
      return next;
    });
  }, []);

  const removeFormula = useCallback(async (id) => {
    if (!isLoggedIn()) return;
    await AxiosInstance.delete(`/invest/formulas/${id}/`);
    setFormulas((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { formulas, loading, error, refetch, upsertLocal, removeFormula };
}
