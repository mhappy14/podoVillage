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

const { Text, Title } = Typography;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

// 시험유형(examtype) 분류 — 사용자 요구사항: 기술사/기사/국가직/서울시
// Exam 모델의 examtype("License"/"Public"/...) + ragent + examname 조합으로 도출
function deriveExamCategory(exam) {
  if (!exam) return "기타";
  if (exam.examtype === "Public") {
    return exam.ragent || "공무원";
  }
  // License (자격증) → "기술사" 또는 "기사" 등 examname 에서 추정
  const name = exam.examname || "";
  if (name.includes("기술사")) return "기술사";
  if (name.includes("기사")) return "기사";
  if (name.includes("산업기사")) return "산업기사";
  if (name.includes("기능사")) return "기능사";
  return exam.examtype === "License" ? "자격증" : "기타";
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

  // 4 필터
  const [fCategory, setFCategory] = useState(null); // 시험유형
  const [fExamId, setFExamId] = useState(null);     // 시험명 (Exam.id)
  const [fYear, setFYear] = useState(null);         // 연도
  const [fNumber, setFNumber] = useState(null);     // 회차

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

  // ===== 필터 옵션 =====
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

  // ===== 필터링 =====
  const visible = useMemo(() => {
    return enriched.filter((it) => {
      if (fCategory && it.category !== fCategory) return false;
      if (fExamId && it.examObj.id !== fExamId) return false;
      if (fYear && it.year !== fYear) return false;
      if (fNumber && it.examnumber !== fNumber) return false;
      return true;
    }).sort((a, b) => {
      // 최신 연도 + 회차 내림차순
      if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
      return (b.examnumber || 0) - (a.examnumber || 0);
    });
  }, [enriched, fCategory, fExamId, fYear, fNumber]);

  const resetFilters = () => {
    setFCategory(null);
    setFExamId(null);
    setFYear(null);
    setFNumber(null);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          시험 보관소{" "}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            ({visible.length}건 / 총 {enriched.length}건)
          </Text>
        </Title>
        <Space>
          <Button onClick={resetFilters}>필터 초기화</Button>
          <Link to="/study/write">
            <Button type="primary">해설 작성</Button>
          </Link>
        </Space>
      </div>

      {/* 4-필터 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>시험유형</Text>
          <Select
            value={fCategory}
            onChange={(v) => { setFCategory(v); setFExamId(null); setFYear(null); setFNumber(null); }}
            options={categoryOptions}
            placeholder="기술사 / 기사 / 국가직 / 서울시 ..."
            allowClear
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>시험명</Text>
          <Select
            value={fExamId}
            onChange={(v) => { setFExamId(v); setFYear(null); setFNumber(null); }}
            options={examNameOptions}
            placeholder="조경기술사 / 도시계획기술사 ..."
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
      ) : visible.length === 0 ? (
        <Empty description="조건에 맞는 시험이 없습니다." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 160px)",
            gap: 16,
            justifyContent: "start",
          }}
        >
          {visible.map((it) => (
            <Link key={it.id} to={`/study/view/${it.id}`} style={{ textDecoration: "none" }}>
              <ExamIcon item={it} />
            </Link>
          ))}
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
        height: 120,
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
            fontSize: 10,
            color: "#1677ff",
            fontWeight: 600,
            letterSpacing: 0.5,
            marginBottom: 2,
          }}
        >
          {item.category}
        </div>
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
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          {item.examnumber}회
        </div>
      </div>
    </div>
  );
}

export default Study;
