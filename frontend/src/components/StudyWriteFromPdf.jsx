// =====================================================================
// StudyWriteFromPdf.jsx — 기술사 기출문제 PDF 자동 파싱 + 단계별 등록
// ---------------------------------------------------------------------
// 처리 흐름:
//   1) PDF 업로드(여러 개 가능) → 각 파일마다 POST /parse-exam-pdf/
//      → 파싱 결과를 "항목(item)" 으로 누적
//   2) 각 항목별로 Exam / 연도 / 회차를 확인·보정 (가로 캐러셀로 넘기며 검토)
//   3) Examnumber — DB 조회 → 있으면 재사용, 없으면 새로 POST
//   4) ExamQsubject — 기술사면 esn=1~4 자동, 회차/교시별 조회 → 없으면 POST
//   5) Question — qnumber 로 중복 체크 → 있으면 "이미 등록" + 인라인 편집
//      없으면 새로 POST
//   6) "전체 일괄 등록" — 누적된 모든 항목을 한 번에 등록
//
// 연도 기본값: 현재 연도 (PDF에서 추출되면 덮어씀)
// =====================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Button, Select, InputNumber, message, Card, Typography, Tag,
  Space, Spin, Alert, Input, Tooltip,
} from "antd";
import {
  InboxOutlined, ReloadOutlined, ThunderboltOutlined,
  DeleteOutlined, EditOutlined, CheckCircleOutlined,
  LeftOutlined, RightOutlined, CloseOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";

// 다중 PDF 업로드 → 가로 캐러셀 검토 → 전체 일괄 등록 지원
const { Dragger } = Upload;
const { Text } = Typography;

const asArray = (p) => {
  if (Array.isArray(p)) return p;
  if (p && Array.isArray(p.results)) return p.results;
  return [];
};

// ✨ DRF PageNumberPagination 응답을 끝까지 따라가며 모든 객체를 모은다.
//    /question/ 같이 PAGE_SIZE=50 으로 잘려 들어오는 엔드포인트에서
//    "기존 Question 일부만 잡혀 unique 위반 → 400" 문제를 막기 위함.
async function fetchAllPaginated(path, params = {}) {
  const all = [];
  let page = 1;
  // 무한루프 안전장치
  for (let safety = 0; safety < 200; safety += 1) {
    let res;
    try {
      res = await AxiosInstance.get(path, { params: { ...params, page } });
    } catch (e) {
      // page 가 범위 밖이면 DRF가 404를 줄 수 있다 → 누적된 결과로 종료
      if (e?.response?.status === 404) return all;
      throw e;
    }
    const data = res?.data;
    if (Array.isArray(data)) {
      all.push(...data);
      return all;
    }
    if (data && Array.isArray(data.results)) {
      all.push(...data.results);
      if (!data.next) return all;
      page += 1;
      continue;
    }
    return all;
  }
  return all;
}

// ✨ DRF unique_together 위반 시 메시지 패턴을 식별 (자동 skip 처리용)
function isUniqueViolation(err) {
  const data = err?.response?.data;
  if (!data) return false;
  const flat =
    typeof data === "string"
      ? data
      : JSON.stringify(data);
  return (
    /must make a unique set/i.test(flat) ||
    /already exists/i.test(flat) ||
    /uniq_question_scope/i.test(flat)
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const ENGINEER_PERIODS = [1, 2, 3, 4];
const CARD_WIDTH = 380; // 캐러셀 카드 폭(px)

// =====================================================================
//   Step API helpers (각 단계는 "있으면 사용 / 없으면 생성")
// =====================================================================

async function findOrCreateExamnumber(examId, examnumber, year) {
  // 1) GET (페이지네이션 끝까지) 으로 조회
  const items = await fetchAllPaginated("examnumber/");
  const exist = items.find((en) => {
    const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
    return Number(eid) === Number(examId)
      && Number(en.examnumber) === Number(examnumber)
      && Number(en.year) === Number(year);
  });
  if (exist) return { id: exist.id, created: false };

  // 2) POST 로 생성
  const res = await AxiosInstance.post("examnumber/", {
    exam: examId,
    examnumber: Number(examnumber),
    year: Number(year),
  });
  return { id: res?.data?.id, created: true };
}

async function findOrCreateExamQsubject(examId, examnumberId, esn) {
  // 1) GET (페이지네이션 끝까지) 으로 조회 — exam + examnumber + esn 매칭
  const items = await fetchAllPaginated("examqsubject/");
  const exist = items.find((qs) => {
    const eid  = typeof qs.exam === "object" ? qs.exam?.id : qs.exam;
    const enid = typeof qs.examnumber === "object" ? qs.examnumber?.id : qs.examnumber;
    return Number(eid) === Number(examId)
      && Number(enid) === Number(examnumberId)
      && Number(qs.esn) === Number(esn);
  });
  if (exist) return { id: exist.id, created: false };

  // 2) POST
  const res = await AxiosInstance.post("examqsubject/", {
    exam: examId,
    examnumber: examnumberId,
    esn: Number(esn),
    est: "",
    examstage: null,
  });
  return { id: res?.data?.id, created: true };
}

// ✨ 특정 examnumber 에 속한 ExamQsubject 들로부터 qsId → esn(=stage) 역맵을 구성
async function buildQsIdToStageMap(examnumberId) {
  const items = await fetchAllPaginated("examqsubject/");
  const map = {};
  items.forEach((qs) => {
    const enid = typeof qs.examnumber === "object" ? qs.examnumber?.id : qs.examnumber;
    if (Number(enid) !== Number(examnumberId)) return;
    if (qs.id != null && qs.esn != null) map[qs.id] = qs.esn;
  });
  return map;
}

// ✨ 해당 회차의 모든 Question 을 (stage-qnumber) 키로 매핑.
//    - 백엔드 /question/?examnumber=<id> 로 필터링
//    - 페이지네이션을 끝까지 따라가 모든 결과 수집
//    - examqsubject 가 nested object 면 .esn, ID(숫자)면 qsIdToStage 로 역추적
async function fetchExistingQuestions(examnumberId, qsIdToStage = {}) {
  const items = await fetchAllPaginated("question/", { examnumber: examnumberId });
  const map = {};
  items.forEach((q) => {
    const enid = typeof q.examnumber === "object" ? q.examnumber?.id : q.examnumber;
    if (Number(enid) !== Number(examnumberId)) return;

    const qs = q.examqsubject;
    let esn = null;
    let qsId = null;
    if (qs && typeof qs === "object") {
      esn = qs.esn ?? null;
      qsId = qs.id ?? null;
    } else if (qs != null) {
      qsId = qs;
    }
    // nested 가 없으면 qsId 로 stage 역추적
    if (esn == null && qsId != null && qsIdToStage[qsId] != null) {
      esn = qsIdToStage[qsId];
    }
    if (esn == null || q.qnumber == null) return;
    map[`${esn}-${q.qnumber}`] = q;
  });
  return map;
}

// =====================================================================

export default function StudyWriteFromPdf({ examList, onImported }) {
  // 각 PDF 1개 = 1 item
  // item: { key, fileName, pages, total_questions, detected,
  //         selectedExamId, year, examnumber, examnumberId, existingMap }
  const [items, setItems]           = useState([]);
  const [parsingCount, setParsing]  = useState(0); // 진행 중인 파싱 개수
  const [saving, setSaving]         = useState(false);
  const [errorMsg, setErrorMsg]     = useState("");

  const scrollerRef = useRef(null);

  const exams = useMemo(() => asArray(examList), [examList]);

  const examIsEngineer = (examId) => {
    const obj = exams.find((e) => Number(e?.id) === Number(examId));
    return !!obj && (obj.examname || "").includes("기술사");
  };

  const totalQuestions = useMemo(
    () => items.reduce((s, it) => s + (it.total_questions || 0), 0),
    [items]
  );

  // ── PDF 업로드 → 파싱 (여러 파일 동시 가능) ──────────────────────────
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
      const newItem = {
        key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        pages: data.pages,
        total_questions: data.total_questions,
        detected: d,
        selectedExamId: exId,
        year: d.year || CURRENT_YEAR,
        examnumber: d.examnumber || null,
        examnumberId: null,
        existingMap: {},
      };
      setItems((prev) => [...prev, newItem]);
      message.success(`${file.name} — 총 ${data.total_questions}문제 인식`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "PDF 파싱 실패";
      message.error(`${file.name}: ${msg}`);
    } finally {
      setParsing((c) => c - 1);
    }
    return false; // antd 자동 업로드 차단
  };

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

  // ── 파싱된 문제 수정/삭제 (항목 내부) ────────────────────────────────
  const updateQ = (key, pageIdx, qIdx, field, val) =>
    patchItem(key, (it) => {
      const pages = it.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions[qIdx] = {
        ...pages[pageIdx].questions[qIdx],
        [field]: val,
      };
      return { pages };
    });

  const removeQ = (key, pageIdx, qIdx) =>
    patchItem(key, (it) => {
      const pages = it.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions.splice(qIdx, 1);
      const total = pages.reduce((s, p) => s + p.questions.length, 0);
      return { pages, total_questions: total };
    });

  // ── 기존 Question PATCH (인라인 편집 후 저장) ────────────────────────
  const saveExistingQuestion = async (key, questionId, qtext) => {
    try {
      await AxiosInstance.patch(`question/${questionId}/`, { qtext });
      message.success("기존 문제 수정 저장됨");
      patchItem(key, (it) => ({
        existingMap: Object.fromEntries(
          Object.entries(it.existingMap).map(([k, v]) =>
            v?.id === questionId ? [k, { ...v, qtext }] : [k, v]
          )
        ),
      }));
    } catch (e) {
      const detail = e?.response?.data
        ? JSON.stringify(e.response.data) : e.message;
      message.error("수정 실패: " + detail);
    }
  };

  // 자식 카드가 (exam/연도/회차) 결정 후 examnumberId·existingMap 을 회신
  const handleResolved = (key, resolved) => patchItem(key, resolved);

  // ── 단일 항목 등록 (handleSaveAll 내부에서 호출) ────────────────────
  const registerOneItem = async (it) => {
    // STEP 1: Examnumber
    const { id: enId, created: enCreated } =
      await findOrCreateExamnumber(it.selectedExamId, it.examnumber, it.year);
    if (!enId) throw new Error("Examnumber 처리 실패");

    // STEP 2: ExamQsubject (기술사면 1~4 자동)
    const isEng = examIsEngineer(it.selectedExamId);
    const allStages = isEng
      ? ENGINEER_PERIODS
      : Array.from(new Set((it.pages || []).map((p) => p.stage)));
    const qsByStage = {};
    for (const s of allStages) {
      const { id: qsId } =
        await findOrCreateExamQsubject(it.selectedExamId, enId, s);
      if (!qsId) throw new Error(`${s}교시 ExamQsubject 처리 실패`);
      qsByStage[s] = qsId;
    }

    // STEP 3: Question 등록 (qnumber 중복 체크)
    const qsIdToStage = Object.fromEntries(
      Object.entries(qsByStage).map(([stage, qsId]) => [qsId, Number(stage)])
    );
    const freshExisting = await fetchExistingQuestions(enId, qsIdToStage);

    let ok = 0, skip = 0, fail = 0;
    for (const page of it.pages || []) {
      const qsId = qsByStage[page.stage];
      if (!qsId) continue;
      for (const q of page.questions || []) {
        if (!q.qtext || !q.qtext.trim()) continue;
        if (freshExisting[`${page.stage}-${q.qnumber}`]) {
          skip += 1;
          continue;
        }
        try {
          await AxiosInstance.post("question/", {
            exam: it.selectedExamId,
            examnumber: enId,
            examqsubject_id: qsId,
            qtype: "Sj",
            qnumber: Number(q.qnumber),
            qtext: q.qtext.slice(0, 1000),
          });
          ok += 1;
        } catch (qe) {
          if (isUniqueViolation(qe)) { skip += 1; continue; }
          const detail = qe?.response?.data
            ? JSON.stringify(qe.response.data) : qe.message;
          console.warn(`[${it.fileName}] Q ${page.stage}-${q.qnumber} 실패:`, detail);
          fail += 1;
        }
      }
    }

    // existingMap 다시 갱신
    const updatedMap = await fetchExistingQuestions(enId, qsIdToStage);
    patchItem(it.key, { examnumberId: enId, existingMap: updatedMap });

    return { ok, skip, fail, enCreated };
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
    let totalOk = 0, totalSkip = 0, totalFail = 0;
    const failedItems = [];

    try {
      for (const it of items) {
        try {
          const { ok, skip, fail } = await registerOneItem(it);
          totalOk += ok; totalSkip += skip; totalFail += fail;
        } catch (e) {
          const detail = e?.response?.data
            ? (typeof e.response.data === "string"
                ? e.response.data : JSON.stringify(e.response.data))
            : (e.message || "등록 실패");
          failedItems.push(`${it.fileName}: ${detail}`);
        }
      }

      const summary = `신규 ${totalOk}건`
        + (totalSkip > 0 ? ` · 이미 있어 건너뜀 ${totalSkip}건` : "")
        + (totalFail > 0 ? ` · 문제 실패 ${totalFail}건` : "");

      if (failedItems.length) {
        setErrorMsg(
          `일부 항목 등록 실패:\n${failedItems.join("\n")}`
        );
        message.warning(`일괄 등록 완료(일부 실패) — ${summary}`);
      } else {
        message.success(`전체 일괄 등록 완료 — ${summary}`);
      }

      onImported?.();
    } catch (e) {
      const msg = e?.message || "일괄 등록 실패";
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
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          PDF 자동 파싱 — 기술사 기출문제 일괄 등록
        </Space>
      }
    >
      {/* ── 업로드 영역 (항상 노출 — 여러 파일 누적 가능) ── */}
      <Dragger
        beforeUpload={beforeUpload}
        accept=".pdf,application/pdf"
        multiple
        showUploadList={false}
        disabled={parsingCount > 0 && items.length === 0}
        style={{ padding: items.length ? "4px 0" : undefined }}
      >
        {parsingCount > 0 ? (
          <div style={{ margin: "8px 0" }}>
            <Spin />
          </div>
        ) : (
          <p className="ant-upload-drag-icon" style={{ marginBottom: items.length ? 0 : undefined }}>
            <InboxOutlined />
          </p>
        )}
        <p className="ant-upload-text">
          {parsingCount > 0
            ? `PDF 파싱 중... (${parsingCount}개 진행)`
            : items.length
              ? "PDF 추가 — 끌어다 놓거나 클릭 (여러 개 가능)"
              : "기출문제 PDF 를 끌어다 놓거나 클릭 (여러 개 가능)"}
        </p>
        {!items.length && (
          <p className="ant-upload-hint">
            기술사 시험문제지 PDF (총 4페이지 / 1~4교시) — 교시별 문제 자동 인식.
            여러 회차를 한꺼번에 올려 가로로 넘기며 확인 후 일괄 등록할 수 있습니다.
          </p>
        )}
      </Dragger>

      {errorMsg && (
        <Alert
          type="error" closable
          message={<span style={{ whiteSpace: "pre-wrap" }}>{errorMsg}</span>}
          onClose={() => setErrorMsg("")}
          style={{ marginTop: 12 }}
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
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  onClick={() => scrollByCard(-1)}
                />
              </Tooltip>
              <Tooltip title="다음">
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  onClick={() => scrollByCard(1)}
                />
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
                onField={(field, val) => patchItem(it.key, { [field]: val })}
                onUpdateQ={(pageIdx, qIdx, field, val) =>
                  updateQ(it.key, pageIdx, qIdx, field, val)}
                onRemoveQ={(pageIdx, qIdx) => removeQ(it.key, pageIdx, qIdx)}
                onResolved={(resolved) => handleResolved(it.key, resolved)}
                onSaveExisting={(qid, txt) => saveExistingQuestion(it.key, qid, txt)}
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
  item, index, total, exams,
  onField, onUpdateQ, onRemoveQ, onResolved, onSaveExisting, onRemoveItem,
}) {
  const {
    fileName, pages, total_questions,
    selectedExamId, year, examnumber, examnumberId, existingMap,
  } = item;

  const selectedExamObj = exams.find(
    (e) => Number(e?.id) === Number(selectedExamId)
  );
  const isEngineer =
    !!selectedExamObj && (selectedExamObj.examname || "").includes("기술사");

  // (exam/회차/연도) 결정 시 — 기존 Question 매핑 미리 로드
  useEffect(() => {
    if (!selectedExamId || !examnumber || !year) {
      onResolved({ examnumberId: null, existingMap: {} });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const enItems = await fetchAllPaginated("examnumber/");
        const matched = enItems.find((en) => {
          const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
          return Number(eid) === Number(selectedExamId)
            && Number(en.examnumber) === Number(examnumber)
            && Number(en.year) === Number(year);
        });
        if (cancelled) return;
        if (!matched) {
          onResolved({ examnumberId: null, existingMap: {} });
          return;
        }
        const qsIdToStage = await buildQsIdToStageMap(matched.id);
        const map = await fetchExistingQuestions(matched.id, qsIdToStage);
        if (!cancelled) onResolved({ examnumberId: matched.id, existingMap: map });
      } catch (e) {
        console.warn("기존 Question 조회 실패:", e);
        if (!cancelled) onResolved({ examnumberId: null, existingMap: {} });
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
            <Text ellipsis style={{ maxWidth: 180 }}>{fileName}</Text>
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
      {/* ── 등록 정보 확인 · 수정 ── */}
      <Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 8 }}>
        <div>
          <Tooltip title="없을 시 Exam 탭에서 추가">
            <span style={{ cursor: "help", fontSize: 12 }}>시험명&nbsp;</span>
          </Tooltip>
          <Select
            value={selectedExamId}
            onChange={(v) => onField("selectedExamId", v)}
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
              onChange={(v) => onField("year", v || CURRENT_YEAR)}
              min={2000}
              max={2100}
              size="small"
              style={{ width: 90 }}
            />
          </span>
          <span style={{ fontSize: 12 }}>
            회차&nbsp;
            <InputNumber
              value={examnumber}
              onChange={(v) => onField("examnumber", v)}
              min={1}
              placeholder="예: 132"
              size="small"
              style={{ width: 80 }}
            />
          </span>
        </Space>
        <Space size={4} wrap>
          {isEngineer && <Tag color="purple">기술사 — 1~4교시 자동</Tag>}
          {examnumberId && <Tag color="green">기존 회차 매칭 (id={examnumberId})</Tag>}
          <Text type="secondary" style={{ fontSize: 12 }}>{total_questions}문제</Text>
        </Space>
      </Space>

      {/* ── 교시별 문제 — 인라인 편집 + 중복 표시 ── */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {pages?.map((p, pageIdx) => {
          const stage = p.stage;
          const dupCount = (p.questions || []).filter(
            (q) => existingMap[`${stage}-${q.qnumber}`]
          ).length;
          return (
            <Card
              key={p.page_index ?? pageIdx}
              size="small"
              style={{ marginBottom: 8 }}
              bodyStyle={{ padding: 8 }}
            >
              <Space style={{ marginBottom: 6 }} size={4} wrap>
                <Tag color="blue">{stage}교시</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {p.questions?.length || 0}문제
                </Text>
                {dupCount > 0 && <Tag color="orange">이미 등록 {dupCount}</Tag>}
              </Space>
              {(p.questions || []).map((q, qIdx) => {
                const exist = existingMap[`${stage}-${q.qnumber}`];
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
                    }}
                  >
                    <InputNumber
                      value={q.qnumber}
                      onChange={(v) => onUpdateQ(pageIdx, qIdx, "qnumber", v || 0)}
                      min={1}
                      max={99}
                      size="small"
                      style={{ width: 52, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isDup ? (
                        <DupQuestionEditor
                          exist={exist}
                          onSave={(newText) => onSaveExisting(exist.id, newText)}
                        />
                      ) : (
                        <Input.TextArea
                          value={q.qtext}
                          onChange={(e) => onUpdateQ(pageIdx, qIdx, "qtext", e.target.value)}
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          maxLength={1000}
                        />
                      )}
                    </div>
                    <Tooltip title="이 문제 제외">
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

// ─────────────────────────────────────────────────────────────────────
// 이미 등록된 문제 — 인라인 편집 (확장 가능)
// ─────────────────────────────────────────────────────────────────────
function DupQuestionEditor({ exist, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(exist?.qtext || "");

  useEffect(() => setText(exist?.qtext || ""), [exist?.id]);

  if (!editing) {
    return (
      <div>
        <Input.TextArea
          value={exist?.qtext || ""}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled
        />
        <div style={{ marginTop: 4, fontSize: 11, color: "#9a3412" }}>
          ⚠ 이미 등록된 문제 (DB) —{" "}
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => setEditing(true)}
            style={{ padding: 0 }}
          >
            오탈자 수정
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoSize={{ minRows: 1, maxRows: 4 }}
        maxLength={1000}
      />
      <div style={{ marginTop: 4 }}>
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              onSave(text);
              setEditing(false);
            }}
          >
            저장
          </Button>
          <Button
            size="small"
            onClick={() => {
              setText(exist?.qtext || "");
              setEditing(false);
            }}
          >
            취소
          </Button>
        </Space>
      </div>
    </div>
  );
}
