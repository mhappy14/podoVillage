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

import React, { useMemo, useState } from "react";
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
} from "antd";
import { InboxOutlined, UploadOutlined, ThunderboltOutlined } from "@ant-design/icons";
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

  const exams = useMemo(() => asArray(examList), [examList]);

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
      // 1) Examnumber 생성 (이미 있으면 백엔드 unique 제약으로 실패 → 캐치 후 fetch)
      let examnumberId;
      try {
        const enRes = await AxiosInstance.post("examnumber/", {
          exam: selectedExamId,
          examnumber,
          year,
        });
        examnumberId = enRes.data?.id;
      } catch (e) {
        // unique 충돌 → 기존 회차 검색
        const list = await AxiosInstance.get("examnumber/");
        const exist = asArray(list.data).find(
          (en) => {
            const eid = typeof en.exam === "object" ? en.exam?.id : en.exam;
            return Number(eid) === Number(selectedExamId)
              && Number(en.examnumber) === Number(examnumber)
              && Number(en.year) === Number(year);
          }
        );
        if (!exist) throw e;
        examnumberId = exist.id;
        message.info("이미 등록된 회차 — 기존 회차에 문제 추가");
      }

      // 2) 페이지별 ExamQsubject + Question 등록
      let total = 0;
      for (const p of parsed.pages || []) {
        // ExamQsubject (교시 = esn, est 비움)
        let qsubjectId;
        try {
          const qsRes = await AxiosInstance.post("examqsubject/", {
            exam: selectedExamId,
            esn: p.stage,
            est: "",
            // examstage 는 기술사가 아닐 수도 있으니 비움
          });
          qsubjectId = qsRes.data?.id;
        } catch (e) {
          // 이미 존재 → 검색
          const list = await AxiosInstance.get("examqsubject/");
          const exist = asArray(list.data).find(
            (qs) => {
              const eid = typeof qs.exam === "object" ? qs.exam?.id : qs.exam;
              return Number(eid) === Number(selectedExamId)
                && Number(qs.esn) === Number(p.stage);
            }
          );
          if (!exist) throw e;
          qsubjectId = exist.id;
        }

        // Question 들
        for (const q of p.questions || []) {
          try {
            await AxiosInstance.post("question/", {
              exam: selectedExamId,
              examnumber: examnumberId,
              examqsubject: qsubjectId,
              qtype: "Sj",
              qnumber: q.qnumber,
              qtext: q.qtext,
            });
            total += 1;
          } catch (e) {
            console.warn(`문제 ${p.stage}교시 ${q.qnumber}번 등록 실패:`, e?.response?.data || e);
          }
        }
      }

      message.success(`총 ${total}문제 등록 완료`);
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

          {/* 페이지별 문제 미리보기 */}
          <div style={{ marginTop: 12, maxHeight: 320, overflowY: "auto" }}>
            {parsed.pages?.map((p) => (
              <Card key={p.page_index} size="small" style={{ marginBottom: 8 }}>
                <Tag color="blue">{p.stage}교시</Tag>
                <Text type="secondary"> {p.questions?.length || 0}문제</Text>
                <List
                  size="small"
                  dataSource={p.questions || []}
                  renderItem={(q) => (
                    <List.Item style={{ padding: "4px 0" }}>
                      <Text>
                        <strong>{q.qnumber}.</strong> {q.qtext}
                      </Text>
                    </List.Item>
                  )}
                />
              </Card>
            ))}
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
