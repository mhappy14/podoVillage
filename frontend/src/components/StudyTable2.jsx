// =====================================================================
// StudyTable2.jsx — 기사 연표 (placeholder: 기술사 연표 구조 복제, 종목 데이터는 추후 반영)
// ---------------------------------------------------------------------
// 상단 고정 헤더(분야/종목 + 연도/회차) / 하단 스크롤 본문 의 4분할 구조.
//   · 세로 스크롤: 좌하단(분야/종목 본문) 패널이 담당 → 스크롤바가 종목 우측,
//     헤더 아래 본문 영역에만 표시된다. 우하단(연도 본문)은 세로 동기화.
//   · 가로 스크롤: 우하단(연도 본문) 패널이 담당 → 스크롤바가 연도 영역 아래에만.
//     연도 헤더는 가로 동기화.
//   · 커서가 올라간 패널 기준으로 좌측=세로 / 우측=가로 스크롤(휠).
// 이미 등록된 시험 칸은 해당 문제(/study/view/:id)로 링크.
// =====================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Select, Typography, Spin, Button, Space, Tooltip } from "antd";
import AxiosInstance from "./AxiosInstance";
import { FIELDS, START_YEAR, roundFor } from "../utils/studyExamConfig";

const { Text, Title } = Typography;

// 이 연표가 다루는 시험유형 (기술사 연표)
const TABLE_CATEGORY = "기사";

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

// 시험유형(examtype) 분류 — PE/Engineer/Public/PSAT → 기술사/기사/공무원/PSAT
function deriveExamCategory(exam) {
  if (!exam) return "기타";
  switch (exam.examtype) {
    case "PE":       return "기술사";
    case "Engineer": return "기사";
    case "Public":   return "공무원";
    case "PSAT":     return "PSAT";
    default: break;
  }
  const name = exam.examname || "";
  if (name.includes("기술사")) return "기술사";
  if (name.includes("기사")) return "기사";
  return "기타";
}

// 시험명 라벨 (공무원이면 ragent + rposition 포함)
function renderExamLabel(exam) {
  if (!exam) return "";
  if (exam.examtype === "Public") {
    return [exam.ragent, exam.rposition, exam.examname].filter(Boolean).join(" ");
  }
  return exam.examname;
}

// 분야/종목 정의(FIELDS) 와 연도·회차 변환(roundFor 등) 은
// ../utils/studyExamConfig 로 분리해 StudyPdfImport 와 공유한다.

// ===== 레이아웃 상수 =====
const ROUND_W = 46;   // 회차 칸 폭
const FIELD_W = 90;   // 분야 칸 폭
const ITEM_W = 132;   // 종목 칸 폭
const LEFT_W = FIELD_W + ITEM_W;
const HEAD1_H = 26;   // 연도(1행) 헤더 높이
const HEAD2_H = 24;   // 회차(2행) 헤더 높이
const ROW_H = 30;     // 본문 행 높이
const ROW_LINE = ROW_H - 1; // 셀 내부 줄높이 (하단 보더 1px 보정 → 행 높이 일치)
const HEAD_H = HEAD1_H + HEAD2_H;

const BORDER = "1px solid #e5e7eb";
const HEAD_BG = "#f5f7fb";

// 셀은 우/하단 보더만 사용해 보더 중복(두께 2px)·높이 오차를 막는다.
const cellBase = { borderRight: BORDER, borderBottom: BORDER, boxSizing: "border-box" };

const StudyTable2 = () => {
  const [exams, setExams] = useState([]);
  const [examnumbers, setExamnumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mypage 에서 설정한 "공부 중인 기술사" 종목들 (localStorage 공유, 다중)
  const [pinnedItems] = useState(() => {
    try {
      const raw = localStorage.getItem("selectedExams");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {
      /* noop */
    }
    const legacy = localStorage.getItem("selectedExam"); // 구버전 단일값 호환
    return legacy ? [legacy] : [];
  });

  // 4 필터 (Study.jsx 와 동일)
  const [fCategory, setFCategory] = useState(null);
  const [fExamId, setFExamId] = useState(null);
  const [fYear, setFYear] = useState(null);
  const [fNumber, setFNumber] = useState(null);

  const headLeftRef = useRef(null);   // 좌상단: 분야/종목 헤더
  const headRightRef = useRef(null);  // 우상단: 연도/회차 헤더 (가로 동기화)
  const leftBodyRef = useRef(null);   // 좌하단: 분야/종목 본문 (세로 스크롤 = 종목 우측)
  const rightBodyRef = useRef(null);  // 우하단: 연도 본문 (가로 스크롤)
  const [vbar, setVbar] = useState(0); // 세로 스크롤바 폭
  const [hbar, setHbar] = useState(0); // 가로 스크롤바 높이

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exRes, enRes] = await Promise.all([
          AxiosInstance.get("exam/"),
          AxiosInstance.get("examnumber/"),
        ]);
        if (cancelled) return;
        setExams(asArray(exRes.data));
        setExamnumbers(asArray(enRes.data));
      } catch (e) {
        console.error("StudyTable: 데이터 로드 실패", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const examMap = useMemo(() => {
    const m = new Map();
    for (const e of exams) m.set(e.id, e);
    return m;
  }, [exams]);

  const enriched = useMemo(() => {
    return examnumbers
      .map((en) => {
        const examObj = en.exam && typeof en.exam === "object"
          ? en.exam
          : examMap.get(en.exam);
        return { ...en, examObj, category: deriveExamCategory(examObj) };
      })
      .filter((it) => !!it.examObj);
  }, [examnumbers, examMap]);

  // ===== 필터 옵션 (Study.jsx 와 동일) =====
  const categoryOptions = useMemo(() => {
    const set = new Set(enriched.map((it) => it.category).filter(Boolean));
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [enriched]);

  const examNameOptions = useMemo(() => {
    const map = new Map();
    enriched.forEach((it) => {
      if (fCategory && it.category !== fCategory) return;
      if (!map.has(it.examObj.id)) {
        map.set(it.examObj.id, {
          value: it.examObj.id,
          label: renderExamLabel(it.examObj),
        });
      }
    });
    return Array.from(map.values());
  }, [enriched, fCategory]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    enriched.forEach((it) => {
      if (fCategory && it.category !== fCategory) return;
      if (fExamId && it.examObj.id !== fExamId) return;
      if (it.year != null) set.add(it.year);
    });
    return Array.from(set).sort((a, b) => b - a).map((v) => ({ value: v, label: `${v}년` }));
  }, [enriched, fCategory, fExamId]);

  const numberOptions = useMemo(() => {
    const set = new Set();
    enriched.forEach((it) => {
      if (fCategory && it.category !== fCategory) return;
      if (fExamId && it.examObj.id !== fExamId) return;
      if (fYear && it.year !== fYear) return;
      if (it.examnumber != null) set.add(it.examnumber);
    });
    return Array.from(set).sort((a, b) => a - b).map((v) => ({ value: v, label: `${v}회` }));
  }, [enriched, fCategory, fExamId, fYear]);

  const resetFilters = () => {
    setFCategory(null);
    setFExamId(null);
    setFYear(null);
    setFNumber(null);
  };

  // ===== 등록된 기술사 시험 조회 맵 =====
  // key: `${종목명}|${회차}`  →  examnumber.id  (종목명 = examname 에서 "기술사" 제거)
  const registered = useMemo(() => {
    const m = new Map();
    enriched.forEach((it) => {
      if (it.category !== TABLE_CATEGORY) return;
      const name = (it.examObj.examname || "").replace(/기술사$/, "");
      if (it.examnumber == null) return;
      m.set(`${name}|${it.examnumber}`, it.id);
    });
    return m;
  }, [enriched]);

  const registeredCount = registered.size;

  // 표시할 연도 목록 (내림차순, 최신이 좌측)
  const years = useMemo(() => {
    const endYear = new Date().getFullYear();
    const arr = [];
    for (let y = endYear; y >= START_YEAR; y--) arr.push(y);
    return arr;
  }, []);

  // 우측(연도) 표 전체 폭 = 연도 수 × 3회 × 회차 칸 폭
  const rightW = years.length * 3 * ROUND_W;

  // ===== 스크롤 동기화 (세로: 좌→우 / 가로: 우본문→우헤더) + 스크롤바 보정 =====
  useEffect(() => {
    if (loading) return;
    const lb = leftBodyRef.current;
    const rb = rightBodyRef.current;
    const hr = headRightRef.current;
    const hl = headLeftRef.current;
    if (!lb || !rb || !hr) return;

    setVbar(lb.offsetWidth - lb.clientWidth);   // 세로 스크롤바 폭
    setHbar(rb.offsetHeight - rb.clientHeight);  // 가로 스크롤바 높이

    const onLeftScroll = () => { rb.scrollTop = lb.scrollTop; };
    const onRightScroll = () => { hr.scrollLeft = rb.scrollLeft; };
    lb.addEventListener("scroll", onLeftScroll, { passive: true });
    rb.addEventListener("scroll", onRightScroll, { passive: true });

    // 우하단 본문 위에서의 휠 → 가로 스크롤 (overflowY:hidden 이라 세로 휠이 묻히는 것 보정)
    const onRightBodyWheel = (e) => {
      const d = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (!d) return;
      rb.scrollLeft += d;
      e.preventDefault();
    };
    rb.addEventListener("wheel", onRightBodyWheel, { passive: false });

    // 헤더 위에서의 휠도 본문 스크롤로 전달
    const onHeadRightWheel = (e) => {
      const d = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (!d) return;
      rb.scrollLeft += d;
      e.preventDefault();
    };
    const onHeadLeftWheel = (e) => {
      if (!e.deltaY) return;
      lb.scrollTop += e.deltaY;
      e.preventDefault();
    };
    hr.addEventListener("wheel", onHeadRightWheel, { passive: false });
    if (hl) hl.addEventListener("wheel", onHeadLeftWheel, { passive: false });

    return () => {
      lb.removeEventListener("scroll", onLeftScroll);
      rb.removeEventListener("scroll", onRightScroll);
      rb.removeEventListener("wheel", onRightBodyWheel);
      hr.removeEventListener("wheel", onHeadRightWheel);
      if (hl) hl.removeEventListener("wheel", onHeadLeftWheel);
    };
  }, [loading, years]);

  const headCell = { ...cellBase, background: HEAD_BG };

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <Title level={4} style={{ flex: "2 1 0%", margin: 0, minWidth: 0 }}>
          {TABLE_CATEGORY} 연표{" "}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            (등록된 시험 {registeredCount}건)
          </Text>
        </Title>
        <div style={{ flex: "3 1 0%", display: "grid" }}>
          <Select
            value={fExamId}
            onChange={(v) => { setFExamId(v); setFYear(null); setFNumber(null); }}
            options={examNameOptions}
            placeholder="기술사 종목 ..."
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
          />
        </div>
        <Space style={{ flex: "3 1 0%", justifyContent: "flex-end" }}>
          <Link to="/study">
            <Button>시험 보관소</Button>
          </Link>
          <Button onClick={resetFilters}>필터 초기화</Button>
          <Link to="/study/write">
            <Button>해설 작성</Button>
          </Link>
        </Space>
      </div>

      {/* 기술사 연표 표 (상단 고정 헤더 / 하단 스크롤 본문) */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "70vh",
            border: BORDER,
            borderRadius: 8,
            overflow: "hidden",
            fontSize: 12,
          }}
        >
          {/* ── 상단 고정 헤더 ── */}
          <div style={{ display: "flex", flex: "0 0 auto" }}>
            {/* 좌상단: 분야 / 종목 헤더 (본문 세로 스크롤바 폭만큼 우측 여백 확보) */}
            <div ref={headLeftRef} style={{ flex: `0 0 ${LEFT_W + vbar}px`, overflow: "hidden" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: LEFT_W }}>
                <thead>
                  <tr style={{ height: HEAD_H }}>
                    <th style={{ ...headCell, width: FIELD_W, minWidth: FIELD_W, height: HEAD_H, padding: "4px" }}>분야</th>
                    <th style={{ ...headCell, width: ITEM_W, minWidth: ITEM_W, height: HEAD_H, padding: "4px" }}>종목</th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* 우상단: 연도 / 회차 헤더 (가로 동기화) */}
            <div ref={headRightRef} style={{ flex: "1 1 auto", overflow: "hidden" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: rightW }}>
                <thead>
                  <tr style={{ height: HEAD1_H }}>
                    {years.map((y) => (
                      <th key={y} colSpan={3} style={{ ...headCell, height: HEAD1_H, padding: "4px 0", fontWeight: 700 }}>
                        {y}년
                      </th>
                    ))}
                  </tr>
                  <tr style={{ height: HEAD2_H }}>
                    {years.map((y) =>
                      [1, 2, 3].map((r) => (
                        <th
                          key={`${y}-${r}`}
                          style={{ ...headCell, width: ROUND_W, minWidth: ROUND_W, height: HEAD2_H, padding: "3px 0", fontWeight: 500, color: "#6b7280" }}
                        >
                          {roundFor(y, r)}회
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
              </table>
            </div>
          </div>

          {/* ── 하단 스크롤 본문 ── */}
          <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
            {/* 좌하단: 분야 / 종목 본문 — 세로 스크롤바가 종목 우측에 표시 */}
            <div
              ref={leftBodyRef}
              style={{ flex: `0 0 ${LEFT_W + vbar}px`, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
            >
              <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: LEFT_W }}>
                <tbody>
                  {pinnedItems.map((item, idx) => (
                    <tr key={`pin-${item}`} style={{ height: ROW_H }}>
                      {idx === 0 && (
                        <td
                          rowSpan={pinnedItems.length}
                          style={{
                            ...cellBase, width: FIELD_W, minWidth: FIELD_W,
                            background: "#fff7e6", padding: "2px 4px",
                            fontSize: 11, fontWeight: 600, color: "#ad6800",
                            textAlign: "center", verticalAlign: "middle",
                            lineHeight: 1.2, overflow: "hidden",
                          }}
                        >
                          내 종목
                        </td>
                      )}
                      <td
                        style={{
                          ...cellBase, width: ITEM_W, minWidth: ITEM_W, height: ROW_H,
                          background: "#fffbe6", padding: "0 8px",
                          fontWeight: 700, color: "#ad6800",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}
                        title={`${item}기술사 (내가 설정한 종목)`}
                      >
                        ★ {item}
                      </td>
                    </tr>
                  ))}
                  {FIELDS.map((grp) =>
                    grp.items.map((item, idx) => (
                      <tr key={`${grp.field}-${item}`} style={{ height: ROW_H }}>
                        {idx === 0 && (
                          <td
                            rowSpan={grp.items.length}
                            style={{
                              ...cellBase, width: FIELD_W, minWidth: FIELD_W,
                              background: "#fafafa", padding: "2px 4px",
                              fontSize: 11, fontWeight: 600, color: "#374151",
                              textAlign: "center", verticalAlign: "middle",
                              lineHeight: 1.2, overflow: "hidden",
                            }}
                          >
                            {grp.field}
                          </td>
                        )}
                        <td
                          style={{
                            ...cellBase, width: ITEM_W, minWidth: ITEM_W, height: ROW_H,
                            background: "#fff", padding: "0 8px",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}
                          title={`${item}기술사`}
                        >
                          {item}
                        </td>
                      </tr>
                    ))
                  )}
                  {hbar > 0 && (
                    <tr style={{ height: hbar }}>
                      <td colSpan={2} style={{ borderRight: BORDER, background: "#fff", padding: 0 }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 우하단: 연도 본문 — 가로 스크롤바가 이 영역 아래에만 표시 */}
            <div
              ref={rightBodyRef}
              style={{ flex: "1 1 auto", overflowX: "auto", overflowY: "hidden", minHeight: 0 }}
            >
              <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: rightW }}>
                <tbody>
                  {pinnedItems.map((item) => (
                    <tr key={`pin-${item}`} style={{ height: ROW_H }}>
                      {years.map((y) =>
                        [1, 2, 3].map((r) => {
                          const round = roundFor(y, r);
                          const enId = registered.get(`${item}|${round}`);
                          return (
                            <td
                              key={`pin-${item}-${y}-${r}`}
                              style={{
                                ...cellBase, width: ROUND_W, minWidth: ROUND_W, height: ROW_H,
                                padding: 0, textAlign: "center",
                                background: enId ? "#ffe7ba" : "#fffbe6",
                              }}
                            >
                              {enId ? (
                                <Tooltip title={`${item}기술사 ${round}회 (${y}년) — 문제 보기`}>
                                  <Link
                                    to={`/study/view/${enId}`}
                                    style={{
                                      display: "block", lineHeight: `${ROW_LINE}px`,
                                      color: "#d46b08", fontWeight: 700, textDecoration: "none",
                                    }}
                                  >
                                    ✓
                                  </Link>
                                </Tooltip>
                              ) : (
                                <span style={{ display: "block", lineHeight: `${ROW_LINE}px`, color: "#e8c98a" }}>·</span>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                  {FIELDS.map((grp) =>
                    grp.items.map((item) => (
                      <tr key={`${grp.field}-${item}`} style={{ height: ROW_H }}>
                        {years.map((y) =>
                          [1, 2, 3].map((r) => {
                            const round = roundFor(y, r);
                            const enId = registered.get(`${item}|${round}`);
                            return (
                              <td
                                key={`${item}-${y}-${r}`}
                                style={{
                                  ...cellBase, width: ROUND_W, minWidth: ROUND_W, height: ROW_H,
                                  padding: 0, textAlign: "center",
                                  background: enId ? "#e6f4ff" : "#fff",
                                }}
                              >
                                {enId ? (
                                  <Tooltip title={`${item}기술사 ${round}회 (${y}년) — 문제 보기`}>
                                    <Link
                                      to={`/study/view/${enId}`}
                                      style={{
                                        display: "block", lineHeight: `${ROW_LINE}px`,
                                        color: "#1677ff", fontWeight: 700, textDecoration: "none",
                                      }}
                                    >
                                      ✓
                                    </Link>
                                  </Tooltip>
                                ) : (
                                  <span style={{ display: "block", lineHeight: `${ROW_LINE}px`, color: "#d1d5db" }}>·</span>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyTable2;
