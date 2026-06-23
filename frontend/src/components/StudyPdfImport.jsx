// =====================================================================
// StudyPdfImport.jsx — 기술사 기출문제 PDF 자동 파싱 + 일괄 등록 UI
// ---------------------------------------------------------------------
// 동작:
//   1) PDF 업로드(여러 개 가능) → 각 파일마다 POST /parse-exam-pdf/
//      → 파싱 결과를 "항목(item)" 으로 누적
//   2) 각 항목을 가로 캐러셀로 넘기며 미리보기 (시험명/회차/연도 + 문제 목록)
//   3) "전체 일괄 등록" 클릭 → 모든 항목에 대해 ExamQsubject + Question 생성
//   - 기술사: ExamQsubject 의 examstage 는 비우고, esn = 교시 번호 (1/2/3/4...),
//     est 는 빈 문자열 ("기술사" 인 경우 모델 clean() 이 허용함)
//   - 회차만 있고 연도가 없으면 기존 등록 회차/공식으로 연도 자동 계산
// =====================================================================

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Upload,
  Button,
  Select,
  message,
  Card,
  Typography,
  Tag,
  Space,
  Spin,
  Alert,
  Input,
  InputNumber,
  Tooltip,
} from "antd";
import {
  InboxOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";
import { deriveYearFromRound } from "../utils/studyExamConfig";

const { Dragger } = Upload;
const { Text } = Typography;

const CARD_WIDTH = 380; // 캐러셀 카드 폭(px)

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

export default function StudyPdfImport({ examList, onImported }) {
  // 각 PDF 1개 = 1 item
  // item: { key, fileName, pages, total_questions, detected,
  //         selectedExamId, year, examnumber, yearAuto, existingMap }
  const [items, setItems] = useState([]);
  const [parsingCount, setParsing] = useState(0); // 진행 중인 파싱 개수
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // 회차→연도 자동 추론에 쓰는 기존 등록 회차 목록
  const [allExamnumbers, setAllExamnumbers] = useState([]);

  const scrollerRef = useRef(null);

  const exams = useMemo(() => asArray(examList), [examList]);

  const totalQuestions = useMemo(
    () => items.reduce((s, it) => s + (it.total_questions || 0), 0),
    [items]
  );

  // 기존에 등록된 회차 목록을 1회 로드 (회차 → 연도 추론용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await AxiosInstance.get("examnumber/");
        if (!cancelled) setAllExamnumbers(asArray(res.data));
      } catch (e) {
        // 조회 실패 시 공식 계산으로 대체되므로 무시
        if (!cancelled) setAllExamnumbers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 항목 일부 필드 패치 (key 기준) ───────────────────────────────────
  const patchItem = (key, patch) =>
    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? { ...it, ...(typeof patch === "function" ? patch(it) : patch) }
          : it
      )
    );

  const removeItem = (key) =>
    setItems((prev) => prev.filter((it) => it.key !== key));

  // 파싱된 문제의 본문/번호 직접 수정
  const updateQ = (key, pageIdx, qIdx, field, val) =>
    patchItem(key, (it) => {
      const pages = it.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions[qIdx] = {
        ...pages[pageIdx].questions[qIdx],
        [field]: val,
      };
      return { pages };
    });

  // 파싱된 문제 삭제 (예: 푸터 노이즈가 잘못 들어왔을 때)
  const removeQ = (key, pageIdx, qIdx) =>
    patchItem(key, (it) => {
      const pages = it.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions.splice(qIdx, 1);
      const total = pages.reduce((s, p) => s + p.questions.length, 0);
      return { pages, total_questions: total };
    });

  // 자식 카드가 (exam/연도/회차) 결정 후 existingMap 을 회신
  const handleResolved = (key, existingMap) => patchItem(key, { existingMap });

  // ── 파일 업로드 핸들러 (여러 파일 동시 가능) ─────────────────────────
  const beforeUpload = async (file) => {
    setErrorMsg("");
    setParsing((c) => c + 1);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await AxiosInstance.post("parse-exam-pdf/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res?.data;
      if (!data?.pages?.length) {
        message.error(`${file.name}: PDF에서 문제를 인식하지 못했습니다.`);
        return false;
      }
      const d = data.detected || {};
      let exId = null;
      if (d.examname) {
        const matched = exams.find((e) => e.examname === d.examname);
        if (matched) exId = matched.id;
      }
      const en = d.examnumber || null;
      let yr = d.year || null;
      let yrAuto = false;
      // 연도 미감지 + 회차 있음 → 자동 계산
      if (!yr && en) {
        const derived = deriveYearFromRound(en, allExamnumbers);
        if (derived) { yr = derived; yrAuto = true; }
      }
      const newItem = {
        key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        pages: data.pages,
        total_questions: data.total_questions || 0,
        detected: d,
        selectedExamId: exId,
        year: yr,
        examnumber: en,
        yearAuto: yrAuto,
        existingMap: {},
      };
      setItems((prev) => [...prev, newItem]);
      message.success(`${file.name} — 총 ${data.total_questions || 0}문제 인식`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "파싱 실패";
      message.error(`${file.name}: ${msg}`);
    } finally {
      setParsing((c) => c - 1);
    }
    return false; // antd 자동 업로드 방지
  };

  // ── 단일 항목 등록 ───────────────────────────────────────────────────
  const registerOneItem = async (it) => {
    // 1) Examnumber 검색 → 없으면 생성
    let examnumberId;
    const list = await AxiosInstance.get("examnumber/");
    const exist = asArray(list.data).find((en) => {
      const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
      return Number(eid) === Number(it.selectedExamId)
        && Number(en.examnumber) === Number(it.examnumber)
        && Number(en.year) === Number(it.year);
    });
    if (exist) {
      examnumberId = exist.id;
    } else {
      try {
        const enRes = await AxiosInstance.post("examnumber/", {
          exam: it.selectedExamId,
          examnumber: it.examnumber,
          year: it.year,
        });
        examnumberId = enRes?.data?.id;
      } catch (e) {
        const detail = e?.response?.data
          ? JSON.stringify(e.response.data)
          : (e?.message || "회차 등록 실패");
        throw new Error(`회차 등록 실패: ${detail}`);
      }
      if (!examnumberId) throw new Error("회차 생성 응답에 id 없음");
    }

    // 2) 페이지별 ExamQsubject + Question 등록
    let total = 0, skipped = 0, failed = 0;
    for (const p of it.pages || []) {
      // ExamQsubject (교시 = esn, est 비움)
      let qsubjectId;
      try {
        const qsRes = await AxiosInstance.post("examqsubject/", {
          exam: it.selectedExamId,
          examnumber: examnumberId,
          esn: p.stage,
          est: "",
          examstage: null,
        });
        qsubjectId = qsRes.data?.id;
      } catch (e) {
        // 이미 존재 → 검색 (exam + examnumber + esn 으로 정확히 매칭)
        const l = await AxiosInstance.get("examqsubject/");
        const ex = asArray(l.data).find((qs) => {
          const eid  = typeof qs.exam === "object" ? qs.exam?.id : qs.exam;
          const enid = typeof qs.examnumber === "object" ? qs.examnumber?.id : qs.examnumber;
          return Number(eid) === Number(it.selectedExamId)
            && Number(enid) === Number(examnumberId)
            && Number(qs.esn) === Number(p.stage);
        });
        if (!ex) throw e;
        qsubjectId = ex.id;
      }

      // Question 들 — 이미 등록된 건은 건너뜀
      for (const q of p.questions || []) {
        if (!q.qtext || !q.qtext.trim()) continue;
        if (it.existingMap[`${p.stage}-${q.qnumber}`]) {
          skipped += 1;
          continue;
        }
        try {
          await AxiosInstance.post("question/", {
            exam: it.selectedExamId,
            examnumber: examnumberId,
            examqsubject_id: qsubjectId,
            qtype: "Sj",
            qnumber: q.qnumber,
            qtext: q.qtext,
          });
          total += 1;
        } catch (e) {
          const detail = e?.response?.data
            ? JSON.stringify(e.response.data) : e?.message;
          console.warn(`[${it.fileName}] ${p.stage}교시 ${q.qnumber}번 등록 실패:`, detail);
          failed += 1;
        }
      }
    }
    return { total, skipped, failed };
  };

  // ── 전체 일괄 등록 ───────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!items.length) return;
    const invalid = items.filter(
      (it) => !it.selectedExamId || !it.year || !it.examnumber
    );
    if (invalid.length) {
      return message.error(
        `등록 정보가 비어있는 항목이 ${invalid.length}개 있습니다 — 시험명/연도/회차를 확인하세요.`
      );
    }

    setSaving(true);
    setErrorMsg("");
    let grandTotal = 0, grandSkip = 0, grandFail = 0;
    const failedItems = [];

    try {
      for (const it of items) {
        try {
          const { total, skipped, failed } = await registerOneItem(it);
          grandTotal += total; grandSkip += skipped; grandFail += failed;
        } catch (e) {
          const detail = e?.response?.data?.detail || e.message || "등록 실패";
          failedItems.push(`${it.fileName}: ${detail}`);
        }
      }

      const summary =
        `신규 ${grandTotal}건` +
        (grandSkip > 0 ? ` · 이미 등록 ${grandSkip}건 건너뜀` : "") +
        (grandFail > 0 ? ` · 문제 실패 ${grandFail}건` : "");

      if (failedItems.length) {
        setErrorMsg(`일부 항목 등록 실패:\n${failedItems.join("\n")}`);
        message.warning(`일괄 등록 완료(일부 실패) — ${summary}`);
      } else {
        message.success(`전체 일괄 등록 완료 — ${summary}`);
        setItems([]);
      }

      onImported?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "일괄 등록 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems([]);
    setErrorMsg("");
  };

  const scrollByCard = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (CARD_WIDTH + 12), behavior: "smooth" });
  };

  return (
    <Card title={<Space><ThunderboltOutlined /> PDF 자동 파싱 (기술사 기출) — 한 개 혹은 여러 개 일괄 등록 가능</Space>}>
      {/* ── 업로드 영역 (항상 노출 — 여러 파일 누적 가능) ── */}
      <Dragger
        beforeUpload={beforeUpload}
        accept=".pdf,application/pdf"
        multiple
        showUploadList={false}
        disabled={parsingCount > 0 && items.length === 0}
        style={{ padding: items.length ? "4px 0" : undefined }}
      >
        <p className="ant-upload-drag-icon" style={{ marginBottom: items.length ? 0 : undefined }}>
          {parsingCount > 0 ? <Spin /> : <InboxOutlined />}
        </p>
        <p className="ant-upload-text">
          {parsingCount > 0
            ? `파싱 중... (${parsingCount}개 진행)`
            : items.length
              ? "PDF 추가 — 끌어다 놓거나 클릭 (여러 개 선택 가능)"
              : "기출문제 PDF 를 끌어다 놓거나 클릭 (여러 개 선택 가능)"}
        </p>
        {!items.length && (
          <p className="ant-upload-hint">
            기술사 시험문제지 PDF (예: 조경기술사 132회) — 페이지별 교시 + 문제 자동 인식.
            여러 회차를 한꺼번에 올려 가로로 넘기며 확인 후 일괄 등록할 수 있습니다.
          </p>
        )}
      </Dragger>

      {errorMsg && (
        <Alert
          type="error"
          message={<span style={{ whiteSpace: "pre-wrap" }}>{errorMsg}</span>}
          style={{ marginTop: 12 }}
          closable
          onClose={() => setErrorMsg("")}
        />
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {/* ── 캐러셀 헤더(개수 + 좌우 네비) ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Space>
              <Tag color="blue">{items.length}개 파일</Tag>
              <Text type="secondary">총 {totalQuestions}문제 인식</Text>
            </Space>
            <Space>
              <Tooltip title="이전">
                <Button size="small" icon={<LeftOutlined />} onClick={() => scrollByCard(-1)} />
              </Tooltip>
              <Tooltip title="다음">
                <Button size="small" icon={<RightOutlined />} onClick={() => scrollByCard(1)} />
              </Tooltip>
            </Space>
          </div>

          {/* ── 가로 캐러셀 ── */}
          <div
            ref={scrollerRef}
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 8,
              scrollSnapType: "x mandatory",
            }}
          >
            {items.map((it, idx) => (
              <PdfItemCard
                key={it.key}
                item={it}
                index={idx}
                total={items.length}
                exams={exams}
                allExamnumbers={allExamnumbers}
                onPatch={(patch) => patchItem(it.key, patch)}
                onUpdateQ={(pageIdx, qIdx, field, val) =>
                  updateQ(it.key, pageIdx, qIdx, field, val)}
                onRemoveQ={(pageIdx, qIdx) => removeQ(it.key, pageIdx, qIdx)}
                onResolved={(map) => handleResolved(it.key, map)}
                onRemoveItem={() => removeItem(it.key)}
              />
            ))}
          </div>

          {/* ── 액션 버튼 ── */}
          <Space style={{ marginTop: 12 }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={saving}>
              전체 초기화
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={saving}
              onClick={handleSaveAll}
            >
              전체 일괄 등록 ({items.length}개 파일)
            </Button>
          </Space>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 항목(파일 1개) 카드 — 캐러셀 슬라이드
// ─────────────────────────────────────────────────────────────────────
function PdfItemCard({
  item, index, total, exams, allExamnumbers,
  onPatch, onUpdateQ, onRemoveQ, onResolved, onRemoveItem,
}) {
  const {
    fileName, pages, total_questions, detected,
    selectedExamId, year, examnumber, yearAuto, existingMap,
  } = item;

  // (시험·회차·연도) 셋 다 결정되면 이미 등록된 문제를 DB 에서 조회 → 표시
  useEffect(() => {
    if (!selectedExamId || !examnumber || !year) {
      onResolved({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const enList = await AxiosInstance.get("examnumber/");
        const matched = asArray(enList.data).find((en) => {
          const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
          return Number(eid) === Number(selectedExamId)
            && Number(en.examnumber) === Number(examnumber)
            && Number(en.year) === Number(year);
        });
        if (!matched) {
          if (!cancelled) onResolved({});
          return;
        }
        const qList = await AxiosInstance.get("question/");
        const map = {};
        for (const q of asArray(qList.data)) {
          const qEnId = typeof q.examnumber === "object" ? q.examnumber?.id : q.examnumber;
          if (Number(qEnId) !== Number(matched.id)) continue;
          const qsObj = q.examqsubject;
          const esn = typeof qsObj === "object" ? qsObj?.esn : null;
          if (esn == null || q.qnumber == null) continue;
          map[`${esn}-${q.qnumber}`] = q;
        }
        if (!cancelled) onResolved(map);
      } catch (e) {
        console.warn("기존 문제 조회 실패:", e);
        if (!cancelled) onResolved({});
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, examnumber, year]);

  return (
    <Card
      size="small"
      data-card
      style={{
        flex: `0 0 ${CARD_WIDTH}px`,
        width: CARD_WIDTH,
        scrollSnapAlign: "start",
        background: "#fafafa",
      }}
      title={
        <Space size={4}>
          <Tag>{index + 1}/{total}</Tag>
          <Tooltip title={fileName}>
            <Text ellipsis style={{ maxWidth: 200 }}>{fileName}</Text>
          </Tooltip>
        </Space>
      }
      extra={
        <Tooltip title="이 파일 제외">
          <Button
            size="small"
            type="text"
            danger
            icon={<CloseOutlined />}
            onClick={onRemoveItem}
          />
        </Tooltip>
      }
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        감지: {detected?.examname || "?"} ·{" "}
        {detected?.examnumber ? `${detected.examnumber}회` : "?"} ·{" "}
        {detected?.year ? `${detected.year}년` : "(연도 미감지)"} · 총 {total_questions}문제
      </Text>

      {/* ── 시험명/연도/회차 보정 입력 ── */}
      <Space direction="vertical" size={6} style={{ width: "100%", margin: "8px 0" }}>
        <div>
          <span style={{ fontSize: 12 }}>시험명&nbsp;</span>
          <Select
            value={selectedExamId}
            onChange={(v) => onPatch({ selectedExamId: v })}
            placeholder="시험명 선택"
            showSearch
            optionFilterProp="label"
            options={exams.map((e) => ({ value: e.id, label: e.examname }))}
            style={{ width: "100%" }}
            size="small"
          />
        </div>
        <Space size={8} wrap>
          <span style={{ fontSize: 12 }}>
            연도&nbsp;
            <InputNumber
              value={year}
              onChange={(v) => onPatch({ year: v || null, yearAuto: false })}
              min={2000}
              max={2100}
              size="small"
              style={{ width: 90 }}
            />
            {yearAuto && year && (
              <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>(자동)</Text>
            )}
          </span>
          <span style={{ fontSize: 12 }}>
            회차&nbsp;
            <InputNumber
              value={examnumber}
              onChange={(v) => {
                const num = v || null;
                const patch = { examnumber: num };
                // 연도가 비었거나 자동 계산값이면 회차에 맞춰 다시 계산
                if (num && (yearAuto || !year)) {
                  const derived = deriveYearFromRound(num, allExamnumbers);
                  if (derived) { patch.year = derived; patch.yearAuto = true; }
                }
                onPatch(patch);
              }}
              min={1}
              placeholder="예: 132"
              size="small"
              style={{ width: 80 }}
            />
          </span>
        </Space>
      </Space>

      {/* ── 페이지별 문제 미리보기 — 인라인 편집 + 중복 표시 ── */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {pages?.map((p, pageIdx) => {
          const dupCount = (p.questions || []).filter(
            (q) => existingMap[`${p.stage}-${q.qnumber}`]
          ).length;
          return (
            <Card
              key={p.page_index ?? pageIdx}
              size="small"
              style={{ marginBottom: 8 }}
              bodyStyle={{ padding: 8 }}
            >
              <Space style={{ marginBottom: 6 }} size={4} wrap>
                <Tag color="blue">{p.stage}교시</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{p.questions?.length || 0}문제</Text>
                {dupCount > 0 && <Tag color="orange">이미 등록 {dupCount}건</Tag>}
              </Space>
              {(p.questions || []).map((q, qIdx) => {
                const exist = existingMap[`${p.stage}-${q.qnumber}`];
                const isDup = !!exist;
                return (
                  <div
                    key={qIdx}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "flex-start",
                      marginBottom: 6,
                      padding: 6,
                      background: isDup ? "#fff7ed" : "transparent",
                      border: isDup ? "1px solid #fed7aa" : "1px solid transparent",
                      borderRadius: 4,
                      opacity: isDup ? 0.85 : 1,
                    }}
                  >
                    <InputNumber
                      value={q.qnumber}
                      onChange={(v) => onUpdateQ(pageIdx, qIdx, "qnumber", v || 0)}
                      min={1}
                      max={99}
                      size="small"
                      style={{ width: 52, flexShrink: 0 }}
                      disabled={isDup}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Input.TextArea
                        value={q.qtext}
                        onChange={(e) => onUpdateQ(pageIdx, qIdx, "qtext", e.target.value)}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        maxLength={1000}
                        disabled={isDup}
                      />
                      {isDup && (
                        <div style={{ fontSize: 11, color: "#9a3412", marginTop: 2 }}>
                          ⚠ 이미 등록된 문제 — 등록 시 건너뜀
                        </div>
                      )}
                    </div>
                    <Tooltip title="이 문제 제외 (잘못 인식된 푸터 등)">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => onRemoveQ(pageIdx, qIdx)}
                      />
                    </Tooltip>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </Card>
  );
}
