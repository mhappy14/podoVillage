// =====================================================================
// StudyPdfImport.jsx — 기술사 기출문제 PDF 자동 파싱 + 일괄 등록 UI
// ---------------------------------------------------------------------
// 동작:
//   1) PDF 업로드 → POST /parse-exam-pdf/ → { detected, pages: [{stage, questions:[...]}] }
//   2) 사용자에게 미리보기 (시험명/회차/연도 + 페이지별 문제 목록)
//   3) "이대로 일괄 등록" 클릭 → 백엔드에 ExamQsubject + Question 들 생성
//   - 기술사: ExamQsubject 의 examstage 는 비우고, esn = 교시 번호 (1/2/3/4...),
//     est 는 빈 문자열 ("기술사" 인 경우 모델 clean() 이 허용함)
// =====================================================================

import React, { useMemo, useState, useEffect } from "react";
import {
  Upload,
  Button,
  Select,
  message,
  Card,
  Typography,
  Tag,
  Space,
  List,
  Spin,
  Alert,
  Input,
  InputNumber,
  Tooltip,
} from "antd";
import {
  InboxOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";

const { Dragger } = Upload;
const { Text, Title } = Typography;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

export default function StudyPdfImport({ examList, onImported }) {
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [year, setYear] = useState(null);
  const [examnumber, setExamnumber] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  // 키 `${stage}-${qnumber}` → DB 에 이미 등록된 question
  const [existingMap, setExistingMap] = useState({});

  const exams = useMemo(() => asArray(examList), [examList]);

  // (시험·회차·연도) 셋 다 결정되면 이미 등록된 문제를 DB 에서 조회 → 표시
  useEffect(() => {
    if (!selectedExamId || !examnumber || !year) {
      setExistingMap({});
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
          if (!cancelled) setExistingMap({});
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
        if (!cancelled) setExistingMap(map);
      } catch (e) {
        console.warn("기존 문제 조회 실패:", e);
        if (!cancelled) setExistingMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedExamId, examnumber, year]);

  // 파싱된 문제의 본문/번호 직접 수정
  const updateQ = (pageIdx, qIdx, field, val) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const pages = prev.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions[qIdx] = {
        ...pages[pageIdx].questions[qIdx],
        [field]: val,
      };
      return { ...prev, pages };
    });
  };

  // 파싱된 문제 삭제 (예: 푸터 노이즈가 잘못 들어왔을 때)
  const removeQ = (pageIdx, qIdx) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const pages = prev.pages.map((p) => ({ ...p, questions: p.questions.slice() }));
      pages[pageIdx].questions.splice(qIdx, 1);
      const total = pages.reduce((s, p) => s + p.questions.length, 0);
      return { ...prev, pages, total_questions: total };
    });
  };

  // 파일 업로드 핸들러
  const beforeUpload = async (file) => {
    setErrorMsg("");
    setLoading(true);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await AxiosInstance.post("parse-exam-pdf/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setParsed(res.data);
      // detected 정보를 폼 초기값으로
      const d = res.data?.detected || {};
      if (d.year) setYear(d.year);
      if (d.examnumber) setExamnumber(d.examnumber);
      if (d.examname) {
        const matched = exams.find((e) => e.examname === d.examname);
        if (matched) setSelectedExamId(matched.id);
      }
      message.success(`PDF 파싱 완료 — 총 ${res.data?.total_questions || 0}문제 인식`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "파싱 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
    return false; // antd 자동 업로드 방지
  };

  const handleSaveAll = async () => {
    if (!parsed) return;
    if (!selectedExamId) return message.error("시험명을 선택하세요");
    if (!year) return message.error("연도를 입력하세요");
    if (!examnumber) return message.error("회차를 입력하세요");

    setSaving(true);
    try {
      // 1) Examnumber 검색 → 없으면 생성
      //    (POST 후 unique 충돌 catch 보다 GET 후 분기가 안전 — 400 노이즈 제거)
      let examnumberId;
      const list = await AxiosInstance.get("examnumber/");
      const exist = asArray(list.data).find(
        (en) => {
          const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
          return Number(eid) === Number(selectedExamId)
            && Number(en.examnumber) === Number(examnumber)
            && Number(en.year) === Number(year);
        }
      );
      if (exist) {
        examnumberId = exist.id;
        message.info("이미 등록된 회차 — 기존 회차에 문제 추가");
      } else {
        try {
          const enRes = await AxiosInstance.post("examnumber/", {
            exam: selectedExamId,
            examnumber,
            year,
          });
          examnumberId = enRes?.data?.id;
        } catch (e) {
          // 진짜 검증 에러 — 응답 그대로 노출
          const detail = e?.response?.data
            ? JSON.stringify(e.response.data)
            : (e?.message || "회차 등록 실패");
          throw new Error(`회차 등록 실패: ${detail}`);
        }
        if (!examnumberId) {
          throw new Error("회차 생성 응답에 id 없음");
        }
      }

      // 2) 페이지별 ExamQsubject + Question 등록
      let total = 0;
      let skipped = 0;
      let failed = 0;
      for (const p of parsed.pages || []) {
        // ExamQsubject (교시 = esn, est 비움)
        let qsubjectId;
        try {
          // 모델 변경: ExamQsubject 가 examnumber FK 를 가짐 → 회차별로 구분
          const qsRes = await AxiosInstance.post("examqsubject/", {
            exam: selectedExamId,
            examnumber: examnumberId,
            esn: p.stage,
            est: "",
            examstage: null,
          });
          qsubjectId = qsRes.data?.id;
        } catch (e) {
          // 이미 존재 → 검색 (exam + examnumber + esn 으로 정확히 매칭)
          const list = await AxiosInstance.get("examqsubject/");
          const exist = asArray(list.data).find((qs) => {
            const eid  = typeof qs.exam === "object" ? qs.exam?.id : qs.exam;
            const enid = typeof qs.examnumber === "object" ? qs.examnumber?.id : qs.examnumber;
            return Number(eid) === Number(selectedExamId)
              && Number(enid) === Number(examnumberId)
              && Number(qs.esn) === Number(p.stage);
          });
          if (!exist) throw e;
          qsubjectId = exist.id;
        }

        // Question 들 — 이미 등록된 건은 건너뜀
        for (const q of p.questions || []) {
          if (!q.qtext || !q.qtext.trim()) continue;
          if (existingMap[`${p.stage}-${q.qnumber}`]) {
            skipped += 1;
            continue;
          }
          try {
            // QuestionSerializer 가 examqsubject 를 read-only nested 로 두고
            // examqsubject_id 를 write-only 필드로 받음 (source="examqsubject")
            await AxiosInstance.post("question/", {
              exam: selectedExamId,
              examnumber: examnumberId,
              examqsubject_id: qsubjectId,
              qtype: "Sj",
              qnumber: q.qnumber,
              qtext: q.qtext,
            });
            total += 1;
          } catch (e) {
            const detail = e?.response?.data
              ? JSON.stringify(e.response.data)
              : e?.message;
            console.warn(`문제 ${p.stage}교시 ${q.qnumber}번 등록 실패:`, detail);
            failed += 1;
          }
        }
      }

      const summary =
        `등록 완료 — 신규 ${total}건` +
        (skipped > 0 ? ` · 이미 등록 ${skipped}건 건너뜀` : "") +
        (failed > 0  ? ` · 실패 ${failed}건` : "");
      message.success(summary);
      setParsed(null);
      onImported?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "일괄 등록 실패";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={<Space><ThunderboltOutlined /> PDF 자동 파싱 (기술사 기출)</Space>}>
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
            {loading ? "파싱 중..." : "기출문제 PDF 를 끌어다 놓거나 클릭"}
          </p>
          <p className="ant-upload-hint">
            기술사 시험문제지 PDF (예: 조경기술사 132회) — 페이지별 교시 + 문제 자동 인식
          </p>
        </Dragger>
      )}

      {errorMsg && <Alert type="error" message={errorMsg} style={{ marginTop: 12 }} closable />}

      {parsed && (
        <div style={{ marginTop: 12 }}>
          <Title level={5} style={{ margin: 0 }}>파싱 결과 미리보기</Title>
          <Text type="secondary">
            감지: {parsed.detected?.examname || "?"} ·{" "}
            {parsed.detected?.examnumber ? `${parsed.detected.examnumber}회` : "?"} ·{" "}
            {parsed.detected?.year ? `${parsed.detected.year}년` : "(연도 미감지)"} ·{" "}
            총 {parsed.total_questions}문제
          </Text>

          {/* 시험명/연도/회차 보정 입력 */}
          <Space wrap style={{ marginTop: 8 }}>
            <span>
              시험명{" "}
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
              연도{" "}
              <input
                type="number"
                value={year || ""}
                onChange={(e) => setYear(Number(e.target.value) || null)}
                style={{ width: 80, padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4 }}
              />
            </span>
            <span>
              회차{" "}
              <input
                type="number"
                value={examnumber || ""}
                onChange={(e) => setExamnumber(Number(e.target.value) || null)}
                style={{ width: 60, padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4 }}
              />
            </span>
          </Space>

          {/* 페이지별 문제 미리보기 — 인라인 편집 + 중복 표시 */}
          <div style={{ marginTop: 12, maxHeight: 480, overflowY: "auto" }}>
            {parsed.pages?.map((p, pageIdx) => {
              const dupCount = (p.questions || []).filter(
                (q) => existingMap[`${p.stage}-${q.qnumber}`]
              ).length;
              return (
                <Card key={p.page_index} size="small" style={{ marginBottom: 8 }}>
                  <Space style={{ marginBottom: 6 }}>
                    <Tag color="blue">{p.stage}교시</Tag>
                    <Text type="secondary">{p.questions?.length || 0}문제</Text>
                    {dupCount > 0 && (
                      <Tag color="orange">이미 등록 {dupCount}건</Tag>
                    )}
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
                          onChange={(v) => updateQ(pageIdx, qIdx, "qnumber", v || 0)}
                          min={1}
                          max={99}
                          style={{ width: 60, flexShrink: 0 }}
                          disabled={isDup}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Input.TextArea
                            value={q.qtext}
                            onChange={(e) => updateQ(pageIdx, qIdx, "qtext", e.target.value)}
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            maxLength={1000}
                            disabled={isDup}
                          />
                          {isDup && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9a3412",
                                marginTop: 2,
                              }}
                            >
                              ⚠ 이미 등록된 문제 — 등록 시 건너뜀 · DB 본문: {exist.qtext} / 수정이 필요하면 해당문제 별 수정하기 버튼을 누르세요
                            </div>
                          )}
                        </div>
                        <Tooltip title="이 문제 제외 (잘못 인식된 푸터 등)">
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

          <Space style={{ marginTop: 12 }}>
            <Button onClick={() => { setParsed(null); setErrorMsg(""); }}>다시 업로드</Button>
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
