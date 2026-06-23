// =====================================================================
// Study.jsx — 시험 회차(Examnumber) 아이콘 그리드 + 4-필터
// ---------------------------------------------------------------------
// 각 카드 = 하나의 Examnumber (특정 시험의 특정 회차).
// 상단 4-필터: 시험유형 / 시험명 / 연도 / 회차
// 카드 클릭 → /study/view/:examnumberId (StudyView)
// =====================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Select, Typography, Empty, Spin, Button, Space } from "antd";
import AxiosInstance from "./AxiosInstance";
import { FIELDS } from "../utils/studyExamConfig";

const { Text, Title } = Typography;

// 상단 시험유형 셀렉트 옵션 (디폴트 = 기술사)
const CATEGORY_OPTIONS = [
  { value: "기술사", label: "기술사" },
  { value: "기사", label: "기사(준비중)", disabled: true },
  { value: "공무원", label: "공무원" },
  { value: "PSAT", label: "PSAT" },
];

// 시험유형별 연표 버튼 라벨/경로
const TABLE_INFO = {
  "기술사": { label: "기술사 연표", path: "/study/table1" },
  "기사":   { label: "기사 연표",   path: "/study/table2" },
  "공무원": { label: "공무원 연표", path: "/study/table3" },
  "PSAT":   { label: "PSAT 연표",   path: "/study/table4" },
};

// Mypage 에서 설정한 "공부 중인 기술사" 종목들 (localStorage 공유, 다중)
const loadPinnedItems = () => {
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
};

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
  // examtype 미설정 데이터 폴백: examname 으로 추정
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

const Study = () => {
  const [exams, setExams] = useState([]);
  const [examnumbers, setExamnumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mypage 에서 선택한 종목 (시험명 셀렉트 상단 고정용)
  const [pinnedItems] = useState(loadPinnedItems);

  // 4 필터
  const [fCategory, setFCategory] = useState("기술사"); // 시험유형 (디폴트: 기술사)
  const [fExamName, setFExamName] = useState(null);     // 시험명
  const [fYear, setFYear] = useState(null);             // 연도
  const [fNumber, setFNumber] = useState(null);         // 회차

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
        console.error("Study: 데이터 로드 실패", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // examnumber 의 exam 정보 빠른 조회용 맵
  const examMap = useMemo(() => {
    const m = new Map();
    for (const e of exams) m.set(e.id, e);
    return m;
  }, [exams]);

  // examnumber 에 exam 객체를 합쳐 풍부한 행으로 변환
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

  // ===== 시험명 매칭 (선택한 시험유형에 따라 다름) =====
  // · 기술사: studyExamConfig 의 종목명(string) 기준. examname 에서 "기술사" 제거 후 비교.
  // · 그 외: API 데이터의 Exam.id 기준 ("id:<n>").
  const matchExamName = (it) => {
    if (!fExamName) return true;
    if (fCategory === "기술사") {
      return (it.examObj.examname || "").replace(/기술사$/, "") === fExamName;
    }
    return `id:${it.examObj.id}` === fExamName;
  };

  // ===== 필터 옵션 =====
  // 시험명: studyExamConfig.js(FIELDS) 에서 읽어온다.
  // 기술사일 때 Mypage 에서 선택한 종목을 맨 위(★)에 고정 노출한다.
  const examNameOptions = useMemo(() => {
    if (fCategory === "기술사") {
      const allItems = FIELDS.flatMap((g) => g.items);
      const pinned = pinnedItems.filter((i) => allItems.includes(i));
      const groups = [];
      if (pinned.length) {
        groups.push({
          label: "★ 내 종목 (마이페이지)",
          options: pinned.map((i) => ({ value: i, label: `★ ${i}기술사` })),
        });
      }
      groups.push(
        ...FIELDS.map((g) => ({
          label: g.field,
          options: g.items.map((i) => ({ value: i, label: `${i}기술사` })),
        }))
      );
      return groups;
    }
    // 기타 시험유형: 등록된 API 데이터에서 도출
    const map = new Map();
    enriched.forEach((it) => {
      if (it.category !== fCategory) return;
      if (!map.has(it.examObj.id)) {
        map.set(it.examObj.id, {
          value: `id:${it.examObj.id}`,
          label: renderExamLabel(it.examObj),
        });
      }
    });
    return Array.from(map.values());
  }, [enriched, fCategory, pinnedItems]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    enriched.forEach((it) => {
      if (fCategory && it.category !== fCategory) return;
      if (!matchExamName(it)) return;
      if (it.year != null) set.add(it.year);
    });
    return Array.from(set).sort((a, b) => b - a).map((v) => ({ value: v, label: `${v}년` }));
  }, [enriched, fCategory, fExamName]);

  const numberOptions = useMemo(() => {
    const set = new Set();
    enriched.forEach((it) => {
      if (fCategory && it.category !== fCategory) return;
      if (!matchExamName(it)) return;
      if (fYear && it.year !== fYear) return;
      if (it.examnumber != null) set.add(it.examnumber);
    });
    return Array.from(set).sort((a, b) => a - b).map((v) => ({ value: v, label: `${v}회` }));
  }, [enriched, fCategory, fExamName, fYear]);

  // ===== 필터링 =====
  const visible = useMemo(() => {
    return enriched.filter((it) => {
      if (fCategory && it.category !== fCategory) return false;
      if (!matchExamName(it)) return false;
      if (fYear && it.year !== fYear) return false;
      if (fNumber && it.examnumber !== fNumber) return false;
      return true;
    }).sort((a, b) => {
      // 최신 연도 + 회차 내림차순
      if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
      return (b.examnumber || 0) - (a.examnumber || 0);
    });
  }, [enriched, fCategory, fExamName, fYear, fNumber]);

  const resetFilters = () => {
    setFCategory("기술사");
    setFExamName(null);
    setFYear(null);
    setFNumber(null);
  };

  const tableInfo = TABLE_INFO[fCategory] || TABLE_INFO["기술사"];

  return (
    <div style={{ padding: "1rem", maxWidth: 1248, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 1000, color: "#1f2937", lineHeight: 1.3, margin: 0 }}>
          {fCategory} 시험 보관소{" "}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            ({visible.length}건 / 총 {enriched.length}건)
          </Text>
        </div>
        <Space>
          <Select
            value={fCategory}
            onChange={(v) => {
              setFCategory(v);
              setFExamName(null);
              setFYear(null);
              setFNumber(null);
            }}
            options={CATEGORY_OPTIONS}
            style={{ width: 130 }}
          />
          <Link to={tableInfo.path}>
            <Button>{tableInfo.label}</Button>
          </Link>
          <Button onClick={resetFilters}>필터 초기화</Button>
          <Link to="/study/write">
            <Button>해설 작성</Button>
          </Link>
        </Space>
      </div>

      {/* 4-필터 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>시험명</Text>
          <Select
            value={fExamName}
            onChange={(v) => { setFExamName(v); setFYear(null); setFNumber(null); }}
            options={examNameOptions}
            placeholder="시험 종목을 선택하세요"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>연도</Text>
          <Select
            value={fYear}
            onChange={(v) => { setFYear(v); setFNumber(null); }}
            options={yearOptions}
            placeholder="연도"
            allowClear
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>회차</Text>
          <Select
            value={fNumber}
            onChange={setFNumber}
            options={numberOptions}
            placeholder="회차"
            allowClear
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* 아이콘 그리드 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 160px)",
            gap: 16,
            justifyContent: "start",
          }}
        >
          {/* 첫번째 슬롯: 시험 등록 아이콘 (필터 무관 항상 노출) */}
          <Link to="/study/write" style={{ textDecoration: "none" }}>
            <RegisterIcon />
          </Link>
          {visible.length === 0 ? (
            <div
              style={{
                gridColumn: "2 / -1",
                color: "#9ca3af",
                fontSize: 13,
                padding: "20px 8px",
              }}
            >
              조건에 맞는 시험이 없습니다.
            </div>
          ) : (
            visible.map((it) => (
              <Link key={it.id} to={`/study/view/${it.id}`} style={{ textDecoration: "none" }}>
                <ExamIcon item={it} />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ---------- 아이콘 카드 (160 × 120) ----------
function ExamIcon({ item }) {
  const ex = item.examObj;
  return (
    <div
      className="study-exam-icon"
      style={{
        width: 160,
        height: 60,
        boxSizing: "border-box",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "linear-gradient(135deg, #fff 0%, #f5f7fb 100%)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "#1677ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1f2937",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {renderExamLabel(ex)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {item.year}년
        </div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {item.examnumber}회
        </div>
      </div>
    </div>
  );
}

// ---------- 새 시험 등록 아이콘 (160 × 120) ----------
function RegisterIcon() {
  return (
    <div
      style={{
        width: 160,
        height: 60,
        boxSizing: "border-box",
        borderRadius: 10,
        border: "2px dashed #93c5fd",
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(22,119,255,0.18)";
        e.currentTarget.style.borderColor = "#1677ff";
        e.currentTarget.style.background = "linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#93c5fd";
        e.currentTarget.style.background = "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)";
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "50%",
          background: "#1677ff",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
          boxShadow: "0 2px 6px rgba(22,119,255,0.35)",
        }}
      >
        <span style={{ position: "relative", width: 14, height: 14 }}>
          <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2.5, transform: "translateY(-50%)", background: "#fff", borderRadius: 2 }} />
          <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2.5, transform: "translateX(-50%)", background: "#fff", borderRadius: 2 }} />
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>
        시험 등록
      </div>
    </div>
  );
}

export default Study;
