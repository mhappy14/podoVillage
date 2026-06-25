// =====================================================================
// StudyScope.jsx — 기술사 종목별 시험범위(출제기준) 표
// ---------------------------------------------------------------------
// StudyTable1(기술사 연표) 과 동일한 4분할(상단 고정 헤더 / 하단 스크롤 본문)
// 레이아웃을 따른다. 다만 우측 영역은 "연도·회차" 대신 출제기준을 보여주는
// 7열 구조다. 우측 헤더 1행은 병합되어 선택한 종목명을(미선택 시 안내문구를)
// 출력하고, 2행에 주요항목(미선택/미등록 시 1과목~7과목) 라벨이 온다.
//   · 종목을 선택하고 출제기준이 등록되어 있으면, 본문에 각 주요항목의
//     세부항목이 열별로 표시된다.
//   · 출제기준 등록 모달에서 PDF(출제기준)를 업로드하면 백엔드
//     /parse-scope-pdf/ 가 필기시험의 주요항목/세부항목을 인식한다.
//     (면접 항목은 무시) 인식 결과는 편집 가능한 input 으로 출력되어
//     오타를 수정한 뒤 등록할 수 있다.
//   · 상단 셀렉트는 studyExamConfig 의 종목을 가나다순으로 나열하되,
//     마이페이지 즐겨찾기(localStorage:selectedExams) 종목을 상단에 반복.
// =====================================================================

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Select, Typography, Button, Space, Tooltip, Modal, Upload, message,
  Input, Spin, Alert, Card,
} from "antd";
import {
  FileAddOutlined, InboxOutlined, DeleteOutlined, PlusOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";
import { FIELDS } from "../utils/studyExamConfig";

const { Text, Title } = Typography;
const { Dragger } = Upload;

const TABLE_CATEGORY = "기술사";

// ===== 레이아웃 상수 (StudyTable1 과 동일 계열) =====
const FIELD_W = 90;    // 분야 칸 폭
const ITEM_W = 132;    // 종목 칸 폭
const LEFT_W = FIELD_W + ITEM_W;
const HEAD_H = 30; // 헤더 전체 높이 (좌/우 동일)
const ROW_H = 30;      // 본문 행 높이
const ROW_LINE = ROW_H - 1;

const BORDER = "1px solid #e5e7eb";
const HEAD_BG = "#f5f7fb";
const cellBase = { borderRight: BORDER, borderBottom: BORDER, boxSizing: "border-box" };

// 우측 헤더 2행 기본 라벨(미등록/미선택 시): 1과목~7과목 (7열)
const SCOPE_COL_COUNT = 7;
const SCOPE_COLUMNS = Array.from({ length: SCOPE_COL_COUNT }, (_, i) => `${i + 1}과목`);

// ── 마이페이지 즐겨찾기 종목 로드 (localStorage 공유, 다중) ──
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

// ── 출제기준(시험범위) 데이터: 종목 → { exam_subject, major_items } ──
const SCOPE_KEY = "scopeData";
const loadScopeData = () => {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (_) {
    /* noop */
  }
  return {};
};

const StudyScope = () => {
  // 마이페이지 즐겨찾기 종목 (상단 고정 + 셀렉트 상단)
  const [pinnedItems] = useState(loadPinnedItems);

  // 출제기준 데이터 (종목별)
  const [scopeData, setScopeData] = useState(loadScopeData);
  const registeredCount = Object.keys(scopeData).length;

  // 상단 셀렉트 (특정 종목만 보기 필터)
  const [fItem, setFItem] = useState(null);

  // 등록 모달 상태
  const [modalItem, setModalItem] = useState(null);  // 등록/편집 중인 종목명
  const [modalParsing, setModalParsing] = useState(false);
  const [modalError, setModalError] = useState("");
  // 편집 버퍼: { exam_subject, major_items: [{ name, details: [] }] }
  const [form, setForm] = useState({ exam_subject: "", major_items: [] });

  const headLeftRef = useRef(null);
  const headRightRef = useRef(null);
  const leftBodyRef = useRef(null);
  const rightBodyRef = useRef(null);
  const [vbar, setVbar] = useState(0);
  const [hbar, setHbar] = useState(0);

  // ── 모든 종목 가나다순 (셀렉트용) ──
  const allItemsSorted = useMemo(() => {
    const set = new Set();
    FIELDS.forEach((grp) => grp.items.forEach((it) => set.add(it)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, []);

  // ── 셀렉트 옵션: 즐겨찾기 상단 반복 + 전체 가나다순 ──
  const itemOptions = useMemo(() => {
    const opts = [];
    if (pinnedItems.length) {
      opts.push({
        label: "내 종목 (즐겨찾기)",
        options: pinnedItems.map((it) => ({ value: `pin:${it}`, label: `★ ${it}` })),
      });
    }
    opts.push({
      label: "전체 종목 (가나다순)",
      options: allItemsSorted.map((it) => ({ value: it, label: it })),
    });
    return opts;
  }, [pinnedItems, allItemsSorted]);

  // 셀렉트 값 → 실제 종목명 (pin: 접두 제거)
  const selectedName = fItem ? fItem.replace(/^pin:/, "") : null;

  const isRegistered = (item) => !!scopeData[item];

  // ── 모달 열기: 기존 데이터가 있으면 불러와 편집 ──
  const openModal = (item) => {
    setModalError("");
    setModalParsing(false);
    const existing = scopeData[item];
    setForm(existing
      ? { exam_subject: existing.exam_subject || "", major_items: (existing.major_items || []).map((m) => ({ name: m.name, details: [...(m.details || [])] })) }
      : { exam_subject: "", major_items: [] });
    setModalItem(item);
  };

  // ── PDF 업로드 → 백엔드 파싱 → 폼에 채움 ──
  const handleParsePdf = async (file) => {
    setModalError("");
    setModalParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await AxiosInstance.post("parse-scope-pdf/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res?.data || {};
      const items = Array.isArray(data.major_items) ? data.major_items : [];
      if (!items.length) {
        setModalError(data.error || "출제기준(필기)의 주요항목을 인식하지 못했습니다.");
      } else {
        setForm({
          exam_subject: data.exam_subject || "",
          major_items: items.map((m) => ({ name: m.name || "", details: [...(m.details || [])] })),
        });
        message.success(`주요항목 ${items.length}개 인식 — 내용을 확인하고 수정하세요.`);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "PDF 파싱 실패";
      setModalError(msg);
    } finally {
      setModalParsing(false);
    }
    return false; // antd 자동 업로드 방지
  };

  // ── 폼 편집 핸들러 ──
  const setMajorName = (i, val) =>
    setForm((f) => {
      const major_items = f.major_items.map((m, idx) => idx === i ? { ...m, name: val } : m);
      return { ...f, major_items };
    });
  const setDetail = (i, j, val) =>
    setForm((f) => {
      const major_items = f.major_items.map((m, idx) => {
        if (idx !== i) return m;
        const details = m.details.map((d, k) => k === j ? val : d);
        return { ...m, details };
      });
      return { ...f, major_items };
    });
  const addDetail = (i) =>
    setForm((f) => ({
      ...f,
      major_items: f.major_items.map((m, idx) => idx === i ? { ...m, details: [...m.details, ""] } : m),
    }));
  const removeDetail = (i, j) =>
    setForm((f) => ({
      ...f,
      major_items: f.major_items.map((m, idx) => idx === i ? { ...m, details: m.details.filter((_, k) => k !== j) } : m),
    }));
  const addMajor = () =>
    setForm((f) => ({ ...f, major_items: [...f.major_items, { name: "", details: [""] }] }));
  const removeMajor = (i) =>
    setForm((f) => ({ ...f, major_items: f.major_items.filter((_, idx) => idx !== i) }));

  // ── 등록(저장) ──
  const handleRegister = () => {
    if (!modalItem) return;
    const cleaned = {
      exam_subject: form.exam_subject || "",
      major_items: form.major_items
        .map((m) => ({ name: (m.name || "").trim(), details: m.details.map((d) => (d || "").trim()).filter(Boolean) }))
        .filter((m) => m.name),
    };
    if (!cleaned.major_items.length) {
      message.error("주요항목을 1개 이상 입력하세요.");
      return;
    }
    setScopeData((prev) => {
      const next = { ...prev, [modalItem]: cleaned };
      try { localStorage.setItem(SCOPE_KEY, JSON.stringify(next)); } catch (_) { /* noop */ }
      return next;
    });
    message.success(`${modalItem}기술사 출제기준이 저장되었습니다.`);
    setModalItem(null);
  };

  // ── 스크롤 동기화 (세로: 좌→우 / 가로: 우본문→우헤더) ──
  useEffect(() => {
    const lb = leftBodyRef.current;
    const rb = rightBodyRef.current;
    const hr = headRightRef.current;
    const hl = headLeftRef.current;
    if (!lb || !rb || !hr) return;

    setVbar(lb.offsetWidth - lb.clientWidth);
    setHbar(rb.offsetHeight - rb.clientHeight);

    const onLeftScroll = () => { if (!detailModeRef.current) rb.scrollTop = lb.scrollTop; };
    const onRightScroll = () => { hr.scrollLeft = rb.scrollLeft; };
    lb.addEventListener("scroll", onLeftScroll, { passive: true });
    rb.addEventListener("scroll", onRightScroll, { passive: true });

    const onHeadLeftWheel = (e) => {
      if (!e.deltaY) return;
      lb.scrollTop += e.deltaY;
      e.preventDefault();
    };
    if (hl) hl.addEventListener("wheel", onHeadLeftWheel, { passive: false });

    return () => {
      lb.removeEventListener("scroll", onLeftScroll);
      rb.removeEventListener("scroll", onRightScroll);
      if (hl) hl.removeEventListener("wheel", onHeadLeftWheel);
    };
  }, []);

  const headCell = { ...cellBase, background: HEAD_BG };

  // ── 상세 보기 모드: 종목 선택 + 출제기준 등록됨 (우하단에만 적용) ──
  const scope = selectedName ? scopeData[selectedName] : null;
  const detailMode = !!(scope && (scope.major_items || []).length);
  const majors = detailMode ? scope.major_items.slice(0, 18) : [];

  // 우하단 그리드: 주요항목 개수별 열·행 구성
  //  ≤6 → 1행 / 7~8 → 2행4열 / 9~10 → 2행5열 / 11~12 → 2행6열 / 13~18 → 3행6열
  const gridCols = (() => {
    const n = majors.length;
    if (n <= 6) return n || 1;
    if (n <= 8) return 4;
    if (n <= 10) return 5;
    return 6;
  })();
  const gridRows = Math.ceil(majors.length / gridCols) || 1;
  const gridPad = gridRows * gridCols - majors.length;

  // 상세 모드에서는 좌/우 행 수가 달라 세로 스크롤 동기화를 끈다.
  const detailModeRef = useRef(detailMode);
  useEffect(() => { detailModeRef.current = detailMode; }, [detailMode]);

  // ── 목록 모드 행 (즐겨찾기 + FIELDS) — 좌하단은 항상 전체 목록 유지 ──
  const rows = useMemo(() => {
    const out = [];
    pinnedItems.forEach((item, idx) => {
      out.push({ key: `pin-${item}`, field: "내 종목", item, showField: idx === 0, fieldRowSpan: pinnedItems.length, isPinned: true });
    });
    FIELDS.forEach((grp) => {
      grp.items.forEach((item, idx) => {
        out.push({ key: `${grp.field}-${item}`, field: grp.field, item, showField: idx === 0, fieldRowSpan: grp.items.length, isPinned: false });
      });
    });
    return out;
  }, [pinnedItems]);

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <Title level={4} style={{ flex: "2 1 0%", margin: 0, minWidth: 0 }}>
          {TABLE_CATEGORY} 시험 범위{" "}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            (출제기준 등록 {registeredCount}건)
          </Text>
        </Title>
        <div style={{ flex: "3 1 0%", display: "grid" }}>
          <Select
            value={fItem}
            onChange={(v) => setFItem(v)}
            options={itemOptions}
            placeholder="기술사 종목 ..."
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: "50%" }}
          />
        </div>
        <Space style={{ flex: "3 1 0%", justifyContent: "flex-end" }}>
          {selectedName && (
            <Button icon={<FileAddOutlined />} onClick={() => openModal(selectedName)}>
              {isRegistered(selectedName) ? "출제기준 수정" : "출제기준 등록"}
            </Button>
          )}
          <Link to="/study">
            <Button>돌아가기</Button>
          </Link>
          <Link to="/study/table1">
            <Button>기술사 연표</Button>
          </Link>
        </Space>
      </div>

      {/* 시험 범위 표 (상단 고정 헤더 / 하단 스크롤 본문) */}
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
          {/* 좌상단: 분야 / 종목 헤더 */}
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
          {/* 우상단: 선택 종목명 (단일 행, 좌측 헤더와 동일 높이) */}
          <div ref={headRightRef} style={{ flex: "1 1 auto", overflow: "hidden" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr style={{ height: HEAD_H }}>
                  <th
                    style={{
                      ...headCell, height: HEAD_H, padding: "3px 8px",
                      fontWeight: selectedName ? 700 : 400,
                      color: selectedName ? "#1677ff" : "#bfbfbf",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                    title={selectedName ? `${selectedName}기술사` : "종목을 선택하세요"}
                  >
                    {selectedName ? `${selectedName}기술사` : "종목을 선택하세요"}
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* ── 하단 스크롤 본문 ── */}
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
          {/* 좌하단: 분야 / 종목 본문 (세로 스크롤) */}
          <div
            ref={leftBodyRef}
            style={{ flex: `0 0 ${LEFT_W + vbar}px`, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
          >
            <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: LEFT_W }}>
              <tbody>
                {rows.map((r) => {
                  const isSel = r.item === selectedName;
                  return (
                    <tr key={r.key} style={{ height: ROW_H }}>
                      {r.showField && (
                        <td
                          rowSpan={r.fieldRowSpan}
                          style={{
                            ...cellBase, width: FIELD_W, minWidth: FIELD_W,
                            background: r.isPinned ? "#fff7e6" : "#fafafa",
                            padding: "2px 4px", fontSize: 11, fontWeight: 600,
                            color: r.isPinned ? "#ad6800" : "#374151",
                            textAlign: "center", verticalAlign: "middle",
                            lineHeight: 1.2, overflow: "hidden",
                          }}
                        >
                          {r.field}
                        </td>
                      )}
                      <td
                        style={{
                          ...cellBase, width: ITEM_W, minWidth: ITEM_W, height: ROW_H,
                          background: isSel ? "#e6f4ff" : (r.isPinned ? "#fffbe6" : "#fff"),
                          padding: "0 8px",
                          fontWeight: (isSel || r.isPinned) ? 700 : 400,
                          color: isSel ? "#1677ff" : (r.isPinned ? "#ad6800" : undefined),
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        <Tooltip title={isRegistered(r.item) ? `${r.item}기술사` : "출제기준을 등록해주세요"}>
                          <span
                            onClick={() => setFItem(r.isPinned ? `pin:${r.item}` : r.item)}
                            style={{ cursor: "pointer" }}
                          >
                            {r.isPinned ? `★ ${r.item}` : r.item}
                          </span>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
                {hbar > 0 && (
                  <tr style={{ height: hbar }}>
                    <td colSpan={2} style={{ borderRight: BORDER, background: "#fff", padding: 0 }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 우하단: 출제기준 본문 — 상세 모드는 주요항목 개수별 열·행 그리드 */}
          <div
            ref={rightBodyRef}
            style={{ flex: "1 1 auto", overflowX: "hidden", overflowY: detailMode ? "auto" : "hidden", minHeight: 0 }}
          >
            {detailMode ? (
              // 상세 모드: 주요항목을 칸 단위로 배치. 각 칸 = 항목명(헤더) + 세부항목.
              // 열·행 수는 주요항목 개수에 따라 결정(gridCols/gridRows).
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                  borderTop: BORDER, borderLeft: BORDER,
                }}
              >
                {majors.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      borderRight: BORDER, borderBottom: BORDER, boxSizing: "border-box",
                      background: "#fff", display: "flex", flexDirection: "column", minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        background: HEAD_BG, fontWeight: 700, padding: "4px 8px",
                        borderBottom: BORDER, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                      title={m.name}
                    >
                      {m.name}
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      {(m.details || []).map((d, j) => (
                        <div
                          key={j}
                          style={{
                            display: "flex", gap: 6, alignItems: "baseline",
                            padding: "3px 0", lineHeight: 1.4, fontSize: "0.68rem",
                          }}
                        >
                          <span style={{ color: "#8c8c8c", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                            {j + 1}.
                          </span>
                          <span style={{ flex: 1, whiteSpace: "normal", wordBreak: "break-word" }}>
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* 마지막 행의 빈 칸 채움 (그리드 경계선 유지) */}
                {Array.from({ length: gridPad }).map((_, k) => (
                  <div
                    key={`pad-${k}`}
                    style={{ borderRight: BORDER, borderBottom: BORDER, boxSizing: "border-box", background: "#fff" }}
                  />
                ))}
              </div>
            ) : (
              <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                  {SCOPE_COLUMNS.map((c) => <col key={c} style={{ width: `${100 / SCOPE_COLUMNS.length}%` }} />)}
                </colgroup>
                <tbody>
                  {rows.map((r) => {
                    if (isRegistered(r.item)) {
                      // 등록됨(목록 모드) — 종목 선택 시 상세가 보인다는 안내
                      return (
                        <tr key={r.key} style={{ height: ROW_H }}>
                          <td
                            colSpan={SCOPE_COLUMNS.length}
                            style={{
                              ...cellBase, height: ROW_H, padding: "0 8px", textAlign: "center",
                              background: r.isPinned ? "#fffbe6" : "#f6ffed", color: "#52c41a",
                              lineHeight: `${ROW_LINE}px`,
                            }}
                          >
                            출제기준 등록됨 — 위 종목 선택 시 세부항목 표시
                          </td>
                        </tr>
                      );
                    }
                    // 미등록 → 등록 아이콘 (모달 호출)
                    return (
                      <tr key={r.key} style={{ height: ROW_H }}>
                        <td
                          colSpan={SCOPE_COLUMNS.length}
                          style={{
                            ...cellBase, height: ROW_H, padding: 0, textAlign: "center",
                            background: r.isPinned ? "#fffbe6" : "#fff",
                          }}
                        >
                          <Tooltip title={`${r.item}기술사 출제기준 등록`}>
                            <Button
                              size="small"
                              type="text"
                              icon={<FileAddOutlined />}
                              onClick={() => openModal(r.item)}
                              style={{ color: "#8c8c8c", height: ROW_LINE, lineHeight: `${ROW_LINE}px` }}
                            >
                              출제기준 등록
                            </Button>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── 출제기준 등록/수정 모달 ── */}
      <Modal
        open={!!modalItem}
        width={760}
        title={modalItem ? `${modalItem}기술사 — 출제기준(필기) 등록` : "출제기준 등록"}
        onCancel={() => setModalItem(null)}
        onOk={handleRegister}
        okText="등록"
        cancelText="취소"
        okButtonProps={{ disabled: !form.major_items.length }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          출제기준 PDF 를 업로드하면 필기시험의 주요항목·세부항목을 자동 인식합니다(면접 항목은 제외).
          인식 후 아래 입력칸에서 오타를 수정한 뒤 등록하세요.
        </Text>

        <div style={{ marginTop: 12 }}>
          <Dragger
            accept=".pdf,application/pdf"
            multiple={false}
            showUploadList={false}
            beforeUpload={handleParsePdf}
            disabled={modalParsing}
            style={{ padding: form.major_items.length ? "4px 0" : undefined }}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: form.major_items.length ? 0 : undefined }}>
              {modalParsing ? <Spin /> : <InboxOutlined />}
            </p>
            <p className="ant-upload-text">
              {modalParsing ? "PDF 인식 중..." : "출제기준 PDF 를 끌어다 놓거나 클릭"}
            </p>
            {!form.major_items.length && (
              <p className="ant-upload-hint">예: 조경기술사 출제기준 — 필기시험 주요항목/세부항목 자동 인식</p>
            )}
          </Dragger>
        </div>

        {modalError && (
          <Alert type="error" message={modalError} style={{ marginTop: 12 }} closable onClose={() => setModalError("")} />
        )}

        {/* ── 인식 결과 편집 폼 ── */}
        {form.major_items.length > 0 && (
          <div style={{ marginTop: 12, maxHeight: "48vh", overflowY: "auto" }}>
            {form.major_items.map((m, i) => (
              <Card
                key={i}
                size="small"
                style={{ marginBottom: 8 }}
                bodyStyle={{ padding: 10 }}
                title={
                  <Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}과목</Text>
                    <Input
                      value={m.name}
                      onChange={(e) => setMajorName(i, e.target.value)}
                      placeholder="주요항목명"
                      style={{ width: 320 }}
                      size="small"
                    />
                  </Space>
                }
                extra={
                  <Tooltip title="이 주요항목 삭제">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeMajor(i)} />
                  </Tooltip>
                }
              >
                {m.details.map((d, j) => (
                  <Space key={j} style={{ display: "flex", marginBottom: 6 }} align="start">
                    <Text type="secondary" style={{ fontSize: 11, width: 22, textAlign: "right" }}>{j + 1}.</Text>
                    <Input
                      value={d}
                      onChange={(e) => setDetail(i, j, e.target.value)}
                      placeholder="세부항목"
                      style={{ width: 540 }}
                      size="small"
                    />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeDetail(i, j)} />
                  </Space>
                ))}
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addDetail(i)} style={{ marginTop: 2 }}>
                  세부항목 추가
                </Button>
              </Card>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addMajor} block>
              주요항목 추가
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudyScope;
