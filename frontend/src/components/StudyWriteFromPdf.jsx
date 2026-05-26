// =====================================================================
// StudyWriteFromPdf.jsx — 기술사 기출문제 PDF 자동 파싱 + 단계별 등록
// ---------------------------------------------------------------------
// 처리 흐름:
//   1) PDF 업로드 → POST /parse-exam-pdf/ → { detected, pages: [...] }
//   2) Exam — 사용자가 셀렉터로 선택 (이미 등록되어야 함)
//   3) Examnumber — DB 조회 → 있으면 재사용, 없으면 새로 POST
//   4) ExamQsubject — 기술사면 esn=1~4 자동, 회차/교시별 조회 → 없으면 POST
//   5) Question — qnumber 로 중복 체크 → 있으면 "이미 등록" + 인라인 편집
//      없으면 새로 POST
//
// 연도 기본값: 현재 연도 (PDF에서 추출되면 덮어씀)
// =====================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Upload, Button, Select, InputNumber, message, Card, Typography, Tag,
  Space, Spin, Alert, Collapse, Input, Tooltip,
} from "antd";
import {
  InboxOutlined, UploadOutlined, ReloadOutlined, ThunderboltOutlined,
  DeleteOutlined, EditOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";

const { Dragger } = Upload;
const { Text, Title } = Typography;
const { Panel } = Collapse;

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
  const [parsed, setParsed]                 = useState(null);
  const [loading, setLoading]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [year, setYear]                     = useState(CURRENT_YEAR);
  const [examnumber, setExamnumber]         = useState(null);
  const [errorMsg, setErrorMsg]             = useState("");
  const [existingMap, setExistingMap]       = useState({}); // {esn-qnumber: question}
  const [examnumberId, setExamnumberId]     = useState(null);

  const exams = useMemo(() => asArray(examList), [examList]);

  const selectedExamObj = useMemo(
    () => exams.find((e) => Number(e?.id) === Number(selectedExamId)),
    [exams, selectedExamId]
  );
  const isEngineer = !!selectedExamObj && (selectedExamObj.examname || "").includes("기술사");

  // ── PDF 업로드 → 파싱 ────────────────────────────────────────────────
  const beforeUpload = async (file) => {
    setErrorMsg("");
    setLoading(true);
    setParsed(null);
    setExistingMap({});
    setExamnumberId(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await AxiosInstance.post("parse-exam-pdf/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res?.data;
      if (!data?.pages?.length) {
        setErrorMsg("PDF에서 문제를 인식하지 못했습니다.");
        return false;
      }
      setParsed(data);
      const d = data.detected || {};
      if (d.examnumber) setExamnumber(d.examnumber);
      // 연도 — PDF 에서 추출되면 사용, 아니면 현재 연도 유지
      if (d.year) setYear(d.year);
      else setYear(CURRENT_YEAR);
      if (d.examname) {
        const matched = exams.find((e) => e.examname === d.examname);
        if (matched) setSelectedExamId(matched.id);
      }
      message.success(`PDF 파싱 완료 — 총 ${data.total_questions}문제 인식`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "PDF 파싱 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
    return false; // antd 자동 업로드 차단
  };

  // ── (시험·회차·연도) 결정 시 — DB의 기존 Question 매핑 미리 로드 ────
  useEffect(() => {
    if (!selectedExamId || !examnumber || !year) {
      setExistingMap({});
      setExamnumberId(null);
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
          setExamnumberId(null);
          setExistingMap({});
          return;
        }
        setExamnumberId(matched.id);
        // ✨ qsId → esn 역맵을 먼저 만들어두고 Question 조회 시 nested 가 아닌
        //    PK 로 직렬화돼 들어오더라도 stage 를 정확히 찾을 수 있게 함
        const qsIdToStage = await buildQsIdToStageMap(matched.id);
        const map = await fetchExistingQuestions(matched.id, qsIdToStage);
        if (!cancelled) setExistingMap(map);
      } catch (e) {
        console.warn("기존 Question 조회 실패:", e);
        if (!cancelled) setExistingMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedExamId, examnumber, year]);

  // ── 파싱된 문제 수정/삭제 ─────────────────────────────────────────────
  const updateQ = (pageIdx, qIdx, field, val) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const pages = prev.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions[qIdx] = { ...pages[pageIdx].questions[qIdx], [field]: val };
      return { ...prev, pages };
    });
  };
  const removeQ = (pageIdx, qIdx) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const pages = prev.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions.splice(qIdx, 1);
      const total = pages.reduce((s, p) => s + p.questions.length, 0);
      return { ...prev, pages, total_questions: total };
    });
  };

  // ── 기존 Question PATCH (인라인 편집 후 저장) ────────────────────────
  const saveExistingQuestion = async (questionId, qtext) => {
    try {
      await AxiosInstance.patch(`question/${questionId}/`, { qtext });
      message.success("기존 문제 수정 저장됨");
      // existingMap 갱신
      setExistingMap((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(prev).map(([k, v]) =>
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

  // ── 일괄 등록 핵심 로직 ──────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!parsed) return;
    if (!selectedExamId) return message.error("시험명을 선택하세요.");
    if (!year) return message.error("연도를 입력하세요.");
    if (!examnumber) return message.error("회차를 입력하세요.");

    setSaving(true);
    setErrorMsg("");
    try {
      // STEP 1: Examnumber 찾거나 생성
      const { id: enId, created: enCreated } =
        await findOrCreateExamnumber(selectedExamId, examnumber, year);
      if (!enId) throw new Error("Examnumber 처리 실패");
      setExamnumberId(enId);
      if (enCreated) message.info("새 회차 등록");
      else message.info("기존 회차 사용");

      // STEP 2: 기술사면 ExamQsubject 1~4 자동 (그 외는 페이지의 stage 그대로)
      const allStages = isEngineer
        ? ENGINEER_PERIODS
        : Array.from(new Set((parsed.pages || []).map((p) => p.stage)));
      const qsByStage = {};
      let qsCreatedCount = 0;
      for (const s of allStages) {
        const { id: qsId, created } =
          await findOrCreateExamQsubject(selectedExamId, enId, s);
        if (!qsId) throw new Error(`${s}교시 ExamQsubject 처리 실패`);
        qsByStage[s] = qsId;
        if (created) qsCreatedCount += 1;
      }
      if (qsCreatedCount > 0) {
        message.info(`${qsCreatedCount}개 교시(과목) 신규 생성`);
      }

      // STEP 3: Question 등록 — qnumber 중복 체크
      // ✨ qsByStage(stage→qsId) 로부터 qsId→stage 역맵을 만들어
      //    fetchExistingQuestions 가 nested/PK 어떤 형태로 받든 정확히 매칭되게 함
      const qsIdToStage = Object.fromEntries(
        Object.entries(qsByStage).map(([stage, qsId]) => [qsId, Number(stage)])
      );
      const freshExisting = await fetchExistingQuestions(enId, qsIdToStage);
      setExistingMap(freshExisting);

      let okCount = 0, skipCount = 0, failCount = 0;
      for (const page of parsed.pages || []) {
        const qsId = qsByStage[page.stage];
        if (!qsId) continue;
        for (const q of page.questions || []) {
          if (!q.qtext || !q.qtext.trim()) continue;
          if (freshExisting[`${page.stage}-${q.qnumber}`]) {
            skipCount += 1;
            continue;
          }
          try {
            await AxiosInstance.post("question/", {
              exam: selectedExamId,
              examnumber: enId,
              examqsubject_id: qsId,
              qtype: "Sj",
              qnumber: Number(q.qnumber),
              qtext: q.qtext.slice(0, 1000),
            });
            okCount += 1;
          } catch (qe) {
            // ✨ unique 위반(이미 등록됨)은 실패가 아닌 skip 으로 처리
            if (isUniqueViolation(qe)) {
              skipCount += 1;
              console.info(`Q ${page.stage}-${q.qnumber} 이미 존재 → 건너뜀`);
              continue;
            }
            const detail = qe?.response?.data
              ? JSON.stringify(qe.response.data)
              : qe.message;
            console.warn(`Q ${page.stage}-${q.qnumber} 실패:`, detail);
            failCount += 1;
          }
        }
      }

      const summary = `신규 ${okCount}건`
        + (skipCount > 0 ? ` · 이미 있어 건너뜀 ${skipCount}건` : "")
        + (failCount > 0 ? ` · 실패 ${failCount}건` : "");
      message.success(`등록 완료 — ${summary}`);

      // existingMap 다시 갱신
      const updatedMap = await fetchExistingQuestions(enId, qsIdToStage);
      setExistingMap(updatedMap);

      onImported?.();
    } catch (e) {
      const msg = e?.response?.data
        ? (typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data))
        : (e.message || "일괄 등록 실패");
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setParsed(null);
    setErrorMsg("");
    setExistingMap({});
    setExamnumberId(null);
    setYear(CURRENT_YEAR);
    setExamnumber(null);
    setSelectedExamId(null);
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          PDF 자동 파싱 — 기술사 기출문제 단계별 등록
        </Space>
      }
    >
      {/* ── 업로드 영역 ── */}
      {!parsed && (
        <Dragger
          beforeUpload={beforeUpload}
          accept=".pdf,application/pdf"
          maxCount={1}
          showUploadList={false}
          disabled={loading}
        >
          {/* ✨ Spin( <div> ) 을 <p> 안에 넣으면 hydration 경고가 나므로
                 로딩 상태일 때는 Spin 을 <p> 밖에 별도 렌더 */}
          {loading ? (
            <div style={{ margin: "8px 0" }}>
              <Spin />
            </div>
          ) : (
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
          )}
          <p className="ant-upload-text">
            {loading ? "PDF 파싱 중..." : "기출문제 PDF 를 끌어다 놓거나 클릭"}
          </p>
          <p className="ant-upload-hint">
            기술사 시험문제지 PDF (총 4페이지 / 1~4교시) — 교시별 문제 자동 인식
          </p>
        </Dragger>
      )}

      {errorMsg && (
        <Alert
          type="error" closable
          message={errorMsg}
          onClose={() => setErrorMsg("")}
          style={{ marginTop: 12 }}
        />
      )}

      {parsed && (
        <div style={{ marginTop: 12 }}>
          {/* ── 단계 1·2·3: Exam/회차/연도 보정 입력 ── */}
          <Card
            size="small"
            style={{ marginBottom: 12, background: "#fafafa" }}
            title="등록 정보 확인 · 수정"
          >
            <Space wrap>
              <span>
                <Tooltip title="없을 시 아래 Exam에서 추가바람">
                  <span style={{ cursor: "help" }}>시험명&nbsp;</span>
                </Tooltip>
                <Select
                  value={selectedExamId}
                  onChange={setSelectedExamId}
                  placeholder="시험명 선택"
                  showSearch
                  optionFilterProp="label"
                  options={exams.map((e) => ({ value: e.id, label: e.examname }))}
                  style={{ minWidth: 200 }}
                />
              </span>
              <span>
                연도&nbsp;
                <InputNumber
                  value={year}
                  onChange={(v) => setYear(v || CURRENT_YEAR)}
                  min={2000}
                  max={2100}
                  placeholder={`기본 ${CURRENT_YEAR}`}
                  style={{ width: 100 }}
                />
              </span>
              <span>
                회차&nbsp;
                <InputNumber
                  value={examnumber}
                  onChange={setExamnumber}
                  min={1}
                  placeholder="예: 132"
                  style={{ width: 90 }}
                />
              </span>
              {isEngineer && (
                <Tag color="purple">기술사 — 1~4교시 자동 생성</Tag>
              )}
              {examnumberId && (
                <Tag color="green">기존 회차 매칭 (id={examnumberId})</Tag>
              )}
            </Space>
          </Card>

          {/* ── 단계 5: 교시별 문제 — 인라인 편집 + 중복 표시 ── */}
          <div style={{ marginTop: 12, maxHeight: 480, overflowY: "auto" }}>
            {parsed.pages?.map((p, pageIdx) => {
              const stage = p.stage;
              const dupCount = (p.questions || []).filter(
                (q) => existingMap[`${stage}-${q.qnumber}`]
              ).length;
              return (
                <Card key={p.page_index} size="small" style={{ marginBottom: 8 }}>
                  <Space style={{ marginBottom: 6 }}>
                    <Tag color="blue">{stage}교시</Tag>
                    <Text type="secondary">{p.questions?.length || 0}문제</Text>
                    {dupCount > 0 && (
                      <Tag color="orange">이미 등록 {dupCount}건</Tag>
                    )}
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
                          onChange={(v) => updateQ(pageIdx, qIdx, "qnumber", v || 0)}
                          min={1}
                          max={99}
                          style={{ width: 60, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isDup ? (
                            <DupQuestionEditor
                              exist={exist}
                              onSave={(newText) => saveExistingQuestion(exist.id, newText)}
                            />
                          ) : (
                            <Input.TextArea
                              value={q.qtext}
                              onChange={(e) => updateQ(pageIdx, qIdx, "qtext", e.target.value)}
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
                            onClick={() => removeQ(pageIdx, qIdx)}
                          />
                        </Tooltip>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>

          {/* ── 액션 버튼 ── */}
          <Space style={{ marginTop: 12 }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              다시 업로드
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={saving}
              onClick={handleSaveAll}
            >
              단계별 등록 진행
            </Button>
          </Space>
        </div>
      )}
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
