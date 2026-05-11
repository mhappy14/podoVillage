// =====================================================================
// StudyWriteFromPdf.jsx — 기술사 기출문제 PDF 자동 파싱 + 일괄 등록
// ---------------------------------------------------------------------
// 동작:
//   1) PDF 업로드 → POST /parse-exam-pdf/ → { detected, pages: [...] }
//   2) 파싱 결과 미리보기 (시험명 / 회차 / 연도 + 교시별 문제 목록)
//   3) 사용자가 내용 확인 후 "일괄 등록" 클릭
//      → Examnumber → ExamQsubject(교시) → Question 순서로 순차 등록
//
// 기술사 시험 특성:
//   - PDF 총 4페이지, 각 페이지 = 1~4교시
//   - ExamQsubject: esn = 교시 번호, est = "" (기술사는 과목명 불필요)
//   - examstage 불필요 (모델 clean()에서 기술사 예외 처리됨)
// =====================================================================

import React, { useMemo, useState } from "react";
import {
  Upload,
  Button,
  Select,
  InputNumber,
  message,
  Card,
  Typography,
  Tag,
  Space,
  List,
  Spin,
  Alert,
  Collapse,
} from "antd";
import {
  InboxOutlined,
  UploadOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";

const { Dragger } = Upload;
const { Text, Title } = Typography;
const { Panel } = Collapse;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

// ── 유틸: 기존 ExamQsubject 검색 ──────────────────────────────────────
async function findOrCreateExamQsubject(examId, stage) {
  // 1) 생성 시도
  try {
    const res = await AxiosInstance.post("examqsubject/", {
      exam: examId,
      esn: stage,
      est: "",
    });
    return res.data?.id;
  } catch (_) {
    // 이미 존재(unique 충돌) → 검색으로 fallback
  }
  // 2) 목록에서 검색
  const list = await AxiosInstance.get("examqsubject/");
  const found = asArray(list.data).find(
    (qs) =>
      Number(typeof qs.exam === "object" ? qs.exam?.id : qs.exam) ===
        Number(examId) && Number(qs.esn) === Number(stage)
  );
  if (!found) throw new Error(`${stage}교시 ExamQsubject를 찾을 수 없습니다.`);
  return found.id;
}

// ── 유틸: 기존 Examnumber 검색 ──────────────────────────────────────
async function findOrCreateExamnumber(examId, examnumber, year) {
  // 1) 생성 시도
  try {
    const res = await AxiosInstance.post("examnumber/", {
      exam: examId,
      examnumber,
      year,
    });
    return res.data?.id;
  } catch (_) {
    // unique 충돌 → 검색 fallback
  }
  // 2) 목록에서 검색
  const list = await AxiosInstance.get("examnumber/");
  const found = asArray(list.data).find(
    (en) =>
      Number(typeof en.exam === "object" ? en.exam?.id : en.exam) ===
        Number(examId) &&
      Number(en.examnumber) === Number(examnumber) &&
      Number(en.year) === Number(year)
  );
  if (!found) throw new Error("회차(Examnumber)를 찾을 수 없습니다.");
  message.info("이미 등록된 회차 — 기존 회차에 문제를 추가합니다.");
  return found.id;
}

// ─────────────────────────────────────────────────────────────────────
export default function StudyWriteFromPdf({ examList, onImported }) {
  const [parsed, setParsed]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [year, setYear]                 = useState(null);
  const [examnumber, setExamnumber]     = useState(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [saveLog, setSaveLog]           = useState([]);   // 등록 결과 로그
  const [existingMap, setExistingMap]   = useState({});   // {`${stage}-${qnumber}`: question}

  const exams = useMemo(() => asArray(examList), [examList]);

  // (선택된 시험 / 회차 / 연도) 변경 시 — 동일 회차에 이미 등록된 문제 조회
  // existingMap: 키 `${교시}-${문항번호}` → DB question 객체
  React.useEffect(() => {
    if (!selectedExamId || !examnumber || !year) {
      setExistingMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1) 동일 (exam, examnumber, year) 인 Examnumber 찾기
        const enList = await AxiosInstance.get("examnumber/");
        const matched = asArray(enList.data).find((en) => {
          const exId = typeof en.exam === "object" ? en.exam?.id : en.exam;
          return Number(exId) === Number(selectedExamId)
            && Number(en.examnumber) === Number(examnumber)
            && Number(en.year) === Number(year);
        });
        if (!matched) {
          if (!cancelled) setExistingMap({});
          return;
        }
        // 2) 해당 examnumber 의 모든 question 가져오기
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
        if (!cancelled) setExistingMap(map);
      } catch (e) {
        console.warn("기존 문제 조회 실패:", e);
        if (!cancelled) setExistingMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedExamId, examnumber, year]);

  // ── PDF 업로드 & 파싱 ──────────────────────────────────────────────
  const beforeUpload = async (file) => {
    setErrorMsg("");
    setSaveLog([]);
    setLoading(true);
    setParsed(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await AxiosInstance.post("parse-exam-pdf/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data;
      if (!data?.pages?.length) {
        setErrorMsg("PDF에서 문제를 인식하지 못했습니다. 파일을 확인해주세요.");
        return false;
      }

      setParsed(data);

      // 파싱된 메타 정보를 폼 초기값으로 자동 세팅
      const d = data.detected || {};
      if (d.year)        setYear(d.year);
      if (d.examnumber)  setExamnumber(d.examnumber);
      if (d.examname) {
        const matched = exams.find((e) => e.examname === d.examname);
        if (matched) setSelectedExamId(matched.id);
      }

      const total = data.total_questions || 0;
      message.success(`PDF 파싱 완료 — 총 ${total}문제 인식`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "PDF 파싱 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }

    return false; // antd 자동 업로드 방지
  };

  // ── 일괄 등록 ─────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!parsed)          return;
    if (!selectedExamId)  return message.error("시험명을 선택하세요.");
    if (!year)            return message.error("연도를 입력하세요.");
    if (!examnumber)      return message.error("회차를 입력하세요.");

    setSaving(true);
    setErrorMsg("");
    setSaveLog([]);
    const log = [];

    try {
      // 1) Examnumber 생성 or 조회
      const examnumberId = await findOrCreateExamnumber(
        selectedExamId, examnumber, year
      );

      // 2) 교시별 ExamQsubject + Question 등록
      let totalSaved = 0;
      let totalSkipped = 0;

      for (const p of parsed.pages || []) {
        const stage = p.stage;

        // ExamQsubject (교시)
        let qsubjectId;
        try {
          qsubjectId = await findOrCreateExamQsubject(selectedExamId, stage);
        } catch (e) {
          log.push({ stage, status: "error", msg: e.message });
          continue;
        }

        // Question 개별 등록
        for (const q of p.questions || []) {
          try {
            await AxiosInstance.post("question/", {
              exam:           selectedExamId,
              examnumber:     examnumberId,
              examqsubject_id: qsubjectId,   // write-only FK 필드명
              qtype:          "Sj",
              qnumber:        q.qnumber,
              qtext:          q.qtext,
            });
            totalSaved += 1;
          } catch (e) {
            const detail =
              e?.response?.data?.detail ||
              JSON.stringify(e?.response?.data) ||
              e.message;
            // unique 제약 위반 = 이미 등록된 문제
            const isDup =
              detail?.includes("unique") ||
              detail?.includes("UNIQUE") ||
              e?.response?.status === 400;
            if (isDup) {
              totalSkipped += 1;
            } else {
              log.push({
                stage,
                qnumber: q.qnumber,
                status: "error",
                msg: detail,
              });
            }
          }
        }
        log.push({
          stage,
          status: "ok",
          saved: p.questions?.length - log.filter(
            (l) => l.stage === stage && l.status === "error"
          ).length,
        });
      }

      setSaveLog(log);
      const msg =
        totalSkipped > 0
          ? `등록 완료 — ${totalSaved}문제 신규 등록, ${totalSkipped}문제 중복 건너뜀`
          : `총 ${totalSaved}문제 등록 완료`;
      message.success(msg);
      setParsed(null);
      onImported?.();
    } catch (e) {
      const msg =
        e?.response?.data?.detail || e.message || "일괄 등록 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setParsed(null);
    setErrorMsg("");
    setSaveLog([]);
  };

  // ── 렌더링 ────────────────────────────────────────────────────────
  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          PDF 자동 파싱 — 기술사 기출문제 일괄 등록
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
          <p className="ant-upload-drag-icon">
            {loading ? <Spin /> : <InboxOutlined />}
          </p>
          <p className="ant-upload-text">
            {loading
              ? "PDF 파싱 중..."
              : "기출문제 PDF를 여기에 끌어다 놓거나 클릭하여 업로드"}
          </p>
          <p className="ant-upload-hint">
            기술사 시험문제지 PDF (총 4페이지 / 1~4교시) — 교시별 문제를
            자동 인식합니다.
          </p>
        </Dragger>
      )}

      {/* ── 오류 메시지 ── */}
      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          style={{ marginTop: 12 }}
          closable
          onClose={() => setErrorMsg("")}
        />
      )}

      {/* ── 파싱 결과 미리보기 ── */}
      {parsed && (
        <div style={{ marginTop: 12 }}>
          {/* 감지 요약 */}
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color="green">
              {parsed.detected?.examname || "시험명 미감지"}
            </Tag>
            <Tag color="blue">
              {parsed.detected?.examnumber
                ? `제${parsed.detected.examnumber}회`
                : "회차 미감지"}
            </Tag>
            <Tag color="orange">
              {parsed.detected?.year
                ? `${parsed.detected.year}년`
                : "연도 미감지"}
            </Tag>
            <Tag>총 {parsed.total_questions}문제</Tag>
          </Space>

          {/* 시험명 / 연도 / 회차 보정 입력 */}
          <Card
            size="small"
            style={{ marginBottom: 12, background: "#fafafa" }}
          >
            <Title level={5} style={{ margin: "0 0 8px" }}>
              등록 정보 확인 · 수정
            </Title>
            <Space wrap>
              <span>
                시험명&nbsp;
                <Select
                  value={selectedExamId}
                  onChange={setSelectedExamId}
                  placeholder="시험명 선택"
                  showSearch
                  optionFilterProp="label"
                  options={exams.map((e) => ({
                    value: e.id,
                    label: e.examname,
                  }))}
                  style={{ minWidth: 200 }}
                />
              </span>
              <span>
                연도&nbsp;
                <InputNumber
                  value={year}
                  onChange={setYear}
                  min={2000}
                  max={2100}
                  placeholder="예: 2024"
                  style={{ width: 90 }}
                />
              </span>
              <span>
                회차&nbsp;
                <InputNumber
                  value={examnumber}
                  onChange={setExamnumber}
                  min={1}
                  placeholder="예: 132"
                  style={{ width: 80 }}
                />
              </span>
            </Space>
          </Card>

          {/* 교시별 문제 목록 미리보기 */}
          <Collapse
            size="small"
            defaultActiveKey={parsed.pages?.map((p) => String(p.page_index))}
            style={{ marginBottom: 12 }}
          >
            {parsed.pages?.map((p) => {
              const dupCount = (p.questions || []).filter(
                (q) => existingMap[`${p.stage}-${q.qnumber}`]
              ).length;
              return (
                <Panel
                  key={String(p.page_index)}
                  header={
                    <Space>
                      <Tag color="blue">{p.stage}교시</Tag>
                      <Text type="secondary">{p.questions?.length || 0}문제</Text>
                      {dupCount > 0 && (
                        <Tag color="orange">이미 등록 {dupCount}건</Tag>
                      )}
                    </Space>
                  }
                >
                  <List
                    size="small"
                    dataSource={p.questions || []}
                    renderItem={(q) => {
                      const exist = existingMap[`${p.stage}-${q.qnumber}`];
                      const isDup = !!exist;
                      return (
                        <List.Item
                          style={{
                            padding: "4px 0",
                            opacity: isDup ? 0.55 : 1,
                            background: isDup ? "#fff7ed" : "transparent",
                          }}
                        >
                          <div style={{ width: "100%" }}>
                            <div>
                              <Text>
                                <strong>{q.qnumber}.</strong>&nbsp;{q.qtext}
                              </Text>
                              {isDup && (
                                <Tag color="orange" style={{ marginLeft: 8 }}>
                                  이미 등록됨 → 건너뜀
                                </Tag>
                              )}
                            </div>
                            {isDup && (
                              <div
                                style={{
                                  marginTop: 2,
                                  paddingLeft: 18,
                                  fontSize: 11,
                                  color: "#9a3412",
                                }}
                              >
                                · DB 등록 본문: {exist.qtext}
                              </div>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </Panel>
              );
            })}
          </Collapse>

          {/* 등록 결과 로그 */}
          {saveLog.length > 0 && (
            <Alert
              type="info"
              style={{ marginBottom: 12 }}
              message="등록 결과"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {saveLog.map((l, i) => (
                    <li key={i}>
                      {l.stage}교시:{" "}
                      {l.status === "ok"
                        ? `${l.saved}문제 등록`
                        : `오류 — ${l.msg}`}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          {/* 액션 버튼 */}
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              다시 업로드
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={saving}
              onClick={handleSaveAll}
            >
              이대로 일괄 등록
            </Button>
          </Space>
        </div>
      )}
    </Card>
  );
}
