// =====================================================================
// StudyView.jsx — 특정 회차(Examnumber) 의 모든 문제 + 해설 표시
// ---------------------------------------------------------------------
// URL: /study/view/:id  (id = Examnumber.id)
// 구성:
//   ┌─ 회차 네비게이션 바 (next 회차 = 좌, prev 회차 = 우 — 사용자 요청대로)
//   ├─ 시험과목별 collapse (펼침/접기)
//   │   └─ 각 문제 카드
//   │       └─ ExplanationCarousel (좋아요순, 가로 스크롤, 화살표 + 인터랙션)
// =====================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Card,
  Collapse,
  Typography,
  Button,
  Tooltip,
  Spin,
  Empty,
  Tag,
  Space,
  message,
  Modal,
  Input,
  Alert,
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  BookOutlined,
  EditOutlined,
  ToolOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";
import ExplanationCarousel from "./ExplanationCarousel";
// import StudyWriteQuestion from "./StudyWriteQuestion";
// → 모달 안에서는 시험명/회차가 잠긴 inline 폼을 직접 사용 (아래 QuickAddQuestion)
import { InputNumber, Select, Tabs } from "antd";
import StudyWriteFromPdf from "./StudyWriteFromPdf";
import StudyWriteExplanation from "./StudyWriteExplanation";

const { Title, Text } = Typography;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

function renderExamLabel(exam) {
  if (!exam) return "";
  if (exam.examtype === "Public") {
    return [exam.ragent, exam.rposition, exam.examname].filter(Boolean).join(" ");
  }
  return exam.examname;
}

// 시험단계 라벨 (1차/2차/...)
function stageLabel(stage) {
  if (!stage) return "";
  return { "1st": "1차", "2nd": "2차", "3rd": "3차" }[stage] || stage;
}

// 시험과목 라벨
// - 기술사 (est 없음): "N교시" 만 표시 (esn 을 교시 번호로 사용)
// - 일반 시험: "esn. est"
function qsubjectLabel(qs, examname) {
  if (!qs) return "";
  const isTechnician = (examname || "").includes("기술사");
  if (isTechnician || !qs.est) {
    // 기술사 → 교시 표시 (회차마다 교시 수가 다를 수 있어 esn 그대로 사용)
    return `${qs.esn}교시`;
  }
  return `${qs.esn}. ${qs.est}`;
}

const StudyView = () => {
  const { id } = useParams(); // examnumber id
  const navigate = useNavigate();
  const examnumberId = Number(id);

  const [examnumber, setExamnumber] = useState(null);
  const [allExamnumbers, setAllExamnumbers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qsubjects, setQsubjects] = useState([]);
  const [explanations, setExplanations] = useState([]);
  const [examObj, setExamObj] = useState(null);     // 현재 회차의 Exam 객체 (PDF 모달용)
  const [mainsubjects, setMainsubjects] = useState([]);   // 해설 인라인 작성용 주요과목
  const [detailsubjects, setDetailsubjects] = useState([]); // 해설 인라인 작성용 세부과목
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]); // collapse 상태
  const [addQOpen, setAddQOpen] = useState(false);  // 문제 등록 모달

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // ── STEP 1: 회차 상세를 먼저 가져온다.
        //    ExamnumberSerializer 는 nested question/explanation 까지 포함하지만
        //    하나의 회차이므로 응답 크기 부담이 크지 않다.
        const enRes = await AxiosInstance.get(`examnumber/${examnumberId}/`);
        if (cancelled) return;
        setExamnumber(enRes.data);

        const enExamId = enRes.data?.exam?.id ?? enRes.data?.exam;

        // ── STEP 2: 회차 상세로부터 examId 를 얻은 뒤,
        //            나머지 데이터는 서버단 필터로 "이 시험/이 회차"에만 한정해
        //            병렬로 가져온다. (전체 /question/, /explanation/ 등의
        //            대용량 응답을 받아 5s 타임아웃 나던 문제 해결)
        const [allEnRes, qRes, qsRes, exRes, examDetailRes] = await Promise.all([
          // 같은 시험의 다른 회차들(이전/다음 네비게이션용)
          AxiosInstance.get("examnumber/", {
            params: enExamId ? { exam: enExamId } : {},
          }),
          AxiosInstance.get("question/", { params: { examnumber: examnumberId } }),
          AxiosInstance.get("examqsubject/", {
            params: enExamId ? { exam: enExamId } : {},
          }),
          AxiosInstance.get("explanation/", { params: { examnumber: examnumberId } }),
          // /exam/ 은 depth=3 으로 모든 회차/질문이 nested 돼 매우 무거우므로
          // 한 건만 가져오는 detail endpoint 로 대체
          enExamId
            ? AxiosInstance.get(`exam/${enExamId}/`)
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;

        setAllExamnumbers(asArray(allEnRes.data));
        setQuestions(asArray(qRes.data));
        setQsubjects(asArray(qsRes.data));
        setExplanations(asArray(exRes.data));
        if (examDetailRes?.data) setExamObj(examDetailRes.data);

        // 과목 목록 (해설 인라인 작성용) — 실패해도 메인 로드에 영향 없음
        if (enExamId) {
          try {
            const [mainRes, detailRes] = await Promise.all([
              AxiosInstance.get("mainsubject/", { params: { exam: enExamId } }),
              AxiosInstance.get("detailsubject/", { params: { exam: enExamId } }),
            ]);
            if (!cancelled) {
              setMainsubjects(asArray(mainRes.data));
              setDetailsubjects(asArray(detailRes.data));
            }
          } catch (subjErr) {
            console.warn("과목 목록 로드 실패 (해설 작성 폼용):", subjErr);
          }
        }

        // 로그인 유저
        const token = localStorage.getItem("Token");
        if (token) {
          try {
            const ur = await AxiosInstance.get("users/me/", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!cancelled) setUser(ur.data);
          } catch {}
        }
      } catch (e) {
        console.error("StudyView: 데이터 로드 실패", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [examnumberId]);

  // 현재 회차 + 같은 시험의 다른 회차들 (이전/다음 결정)
  const sameExamSiblings = useMemo(() => {
    if (!examnumber) return [];
    const examId = examnumber.exam?.id ?? examnumber.exam;
    return allExamnumbers
      .filter((en) => {
        const id = en.exam?.id ?? en.exam;
        return id === examId;
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.examnumber - b.examnumber;
      });
  }, [examnumber, allExamnumbers]);

  const currentIndex = sameExamSiblings.findIndex((en) => en.id === examnumberId);
  const prevSibling = currentIndex > 0 ? sameExamSiblings[currentIndex - 1] : null;
  const nextSibling = currentIndex >= 0 && currentIndex < sameExamSiblings.length - 1
    ? sameExamSiblings[currentIndex + 1] : null;

  // 이 회차의 문제들을 examqsubject 별로 그룹핑
  const questionsByQsubject = useMemo(() => {
    const filtered = questions.filter((q) => {
      const enId = q.examnumber?.id ?? q.examnumber;
      return enId === examnumberId;
    });
    const grouped = new Map();
    filtered.forEach((q) => {
      const qsId = q.examqsubject?.id ?? q.examqsubject;
      if (!grouped.has(qsId)) grouped.set(qsId, []);
      grouped.get(qsId).push(q);
    });
    // 과목 순서대로 정렬, 각 과목 내에서는 qnumber 순
    grouped.forEach((arr) => arr.sort((a, b) => (a.qnumber || 0) - (b.qnumber || 0)));
    return grouped;
  }, [questions, examnumberId]);

  // 이 회차의 examqsubject 들 (esn 순 정렬)
  const usedQsubjects = useMemo(() => {
    if (!examnumber) return [];
    const examId = examnumber.exam?.id ?? examnumber.exam;
    const qsIdsInUse = new Set(
      Array.from(questionsByQsubject.keys()).filter((v) => v != null)
    );
    return qsubjects
      .filter((qs) => {
        const eId = qs.exam?.id ?? qs.exam;
        return eId === examId && qsIdsInUse.has(qs.id);
      })
      .sort((a, b) => {
        if (a.examstage !== b.examstage) {
          return (a.examstage || "").localeCompare(b.examstage || "");
        }
        return (a.esn || 0) - (b.esn || 0);
      });
  }, [qsubjects, examnumber, questionsByQsubject]);

  // 모든 collapse 펼치기 — 데이터 로드 완료 시
  useEffect(() => {
    setActiveKeys(usedQsubjects.map((qs) => String(qs.id)));
  }, [usedQsubjects]);

  // ---- 회차 이동 핸들러 ----
  const goSibling = (sib) => {
    if (!sib) return;
    navigate(`/study/view/${sib.id}`);
  };

  const goLatest = () => {
    if (sameExamSiblings.length === 0) return;
    const last = sameExamSiblings[sameExamSiblings.length - 1];
    navigate(`/study/view/${last.id}`);
  };

  const examLabel = useMemo(() => renderExamLabel(examObj ?? examnumber?.exam), [examObj, examnumber]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin tip="로딩 중..." /></div>;
  }
  if (!examnumber) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="해당 회차를 찾을 수 없습니다." />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link to="/study"><Button>시험 목록으로</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      {/* ===== 회차 네비게이션 바 ===== */}
      <Card
        size="small"
        style={{ marginBottom: "0.25rem" }}
        styles={{ body: { padding: "0.25rem" } }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {/* 좌측: 다음 회차로 (사용자 요청 — 차기회차=왼쪽) */}
          <div style={{ flex: "0 0 auto" }}>
            {nextSibling ? (
              <Tooltip title={`다음 회차: ${nextSibling.year}년 ${nextSibling.examnumber}회`}>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => goSibling(nextSibling)}
                >
                  차기회차 ({nextSibling.year}년 {nextSibling.examnumber}회)
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                title={`${(examnumber.examnumber || 0) + 1}회 시험이 아직 등록되지 않았습니다. 현재 등록된 ${examnumber.examnumber}회 시험으로 이동합니다.`}
              >
                <Button icon={<LeftOutlined />} onClick={goLatest} disabled={sameExamSiblings.length === 0}>
                  차기회차 (미등록)
                </Button>
              </Tooltip>
            )}
          </div>

          {/* 가운데: 시험명 + 회차/연도 + Study로 돌아가기 */}
          <div style={{ display:"flex", flex: 1, justifyContent: "center", alignItems: "center", minWidth: 0 }}>
            <Text style={{ flex: 1, textAlign: "center" }} type="secondary">
              {examLabel}
            </Text>
            <Text style={{ flex: 1, textAlign: "center" }} type="secondary">
              {examnumber.year}년 {examnumber.examnumber}회
            </Text>
            <div style={{ flex: 2, textAlign: "center", fontSize: 11, color: "#9ca3af", letterSpacing: 1 }}>
              <Link to="/study" style={{ color: "#1677ff" }}>
                <BookOutlined /> 시험 목록
              </Link>{" "}
              ({sameExamSiblings.length}개 회차 등록됨)
            </div>
          </div>

          {/* 우측: 이전 회차로 (사용자 요청 — 이전회차=오른쪽) */}
          <div style={{ flex: "0 0 auto" }}>
            {prevSibling ? (
              <Tooltip title={`이전 회차: ${prevSibling.year}년 ${prevSibling.examnumber}회`}>
                <Button
                  onClick={() => goSibling(prevSibling)}
                >
                  이전회차 ({prevSibling.year}년 {prevSibling.examnumber}회) <RightOutlined />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                title={`${(examnumber.examnumber || 0) - 1}회 시험이 아직 등록되지 않았습니다. 현재 등록된 ${examnumber.examnumber}회 시험으로 이동합니다.`}
              >
                <Button onClick={goLatest} disabled={sameExamSiblings.length === 0}>
                  이전회차 (미등록) <RightOutlined />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </Card>

      {/* ===== 시험과목 collapse + 문제 + 해설 ===== */}
      {usedQsubjects.length === 0 ? (
        <Card>
          <Empty description="이 회차에 등록된 문제가 없습니다." />
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddQOpen(true)}>
              문제 등록
            </Button>
          </div>
        </Card>
      ) : (
        <Collapse
          activeKey={activeKeys}
          onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
          items={usedQsubjects.map((qs) => {
            const qList = questionsByQsubject.get(qs.id) || [];
            return {
              key: String(qs.id),
              label: (
                <Space>
                  {qs.examstage && <Tag color="blue">{stageLabel(qs.examstage)}</Tag>}
                  <strong>
                    {qsubjectLabel(qs, examnumber?.exam?.examname)}
                  </strong>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {qList.length}문제
                  </Text>
                </Space>
              ),
              children: (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {qList.map((q) => (
                    <QuestionBlock
                      key={q.id}
                      question={q}
                      explanations={explanations}
                      user={user}
                      examObj={examObj}
                      examnumber={examnumber}
                      allExamnumbers={allExamnumbers}
                      questions={questions}
                      mainsubjects={mainsubjects}
                      detailsubjects={detailsubjects}
                      onExplanationAdded={(newExp) => {
                        setExplanations((prev) => [...prev, newExp]);
                      }}
                    />
                  ))}
                </div>
              ),
            };
          })}
        />
      )}

      {/* ===== 누락된 문제 추가 등록 버튼 ===== */}
      {usedQsubjects.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Tooltip title="현재 회차에 누락된 문제를 직접 추가합니다">
            <Button
              type="dashed"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => setAddQOpen(true)}
              style={{ minWidth: 240 }}
            >
              문제 등록 (누락된 문제 추가)
            </Button>
          </Tooltip>
        </div>
      )}

      {/* ===== 문제 등록 모달 — StudyWriteQuestion 재사용 ===== */}
      <Modal
        title={
          <span>
            <PlusOutlined /> 문제 등록 — {examLabel} {examnumber?.year}년 {examnumber?.examnumber}회
          </span>
        }
        open={addQOpen}
        onCancel={() => setAddQOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        {examnumber && (
          <Tabs
            defaultActiveKey="manual"
            items={[
              {
                key: "manual",
                label: "수동 입력 (한 문제씩)",
                children: (
                  <QuickAddQuestion
                    examnumber={examnumber}
                    examLabel={examLabel}
                    usedQsubjects={usedQsubjects}
                    onCreated={(newQ) => {
                      setQuestions((prev) => [...prev, newQ]);
                      // ✨ 이 시험의 examqsubject 만 다시 가져온다 (전체 X)
                      const examIdLocal =
                        examnumber?.exam?.id ?? examnumber?.exam;
                      AxiosInstance.get("examqsubject/", {
                        params: examIdLocal ? { exam: examIdLocal } : {},
                      })
                        .then((r) => setQsubjects(asArray(r.data)))
                        .catch(() => {});
                    }}
                  />
                ),
              },
              {
                key: "pdf",
                label: "PDF 일괄 등록 (기술사 기출)",
                children: (
                  <div>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message={`PDF 업로드 — ${examLabel} ${examnumber?.year}(${examnumber?.examnumber}회) 컨텍스트`}
                      description="시험명·회차는 현재 보고 있는 시험으로 매핑됩니다. PDF에서 다른 회차가 인식되면 사용자가 수동으로 보정할 수 있습니다."
                    />
                    <StudyWriteFromPdf
                      examList={examObj ? [examObj] : []}
                      onImported={() => {
                        // ✨ 등록 후 이 회차/이 시험에 한정된 데이터만 재요청
                        const examIdLocal =
                          examnumber?.exam?.id ?? examnumber?.exam;
                        AxiosInstance.get("question/", {
                          params: { examnumber: examnumberId },
                        })
                          .then((r) => setQuestions(asArray(r.data)))
                          .catch(() => {});
                        AxiosInstance.get("examqsubject/", {
                          params: examIdLocal ? { exam: examIdLocal } : {},
                        })
                          .then((r) => setQsubjects(asArray(r.data)))
                          .catch(() => {});
                        setAddQOpen(false);
                        message.success("PDF 일괄 등록 완료");
                      }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

// ---------- 한 문제 + 해설 carousel ----------
function QuestionBlock({
  question: initialQ,
  explanations,
  user,
  examObj,
  examnumber,
  allExamnumbers,
  questions,
  mainsubjects,
  detailsubjects,
  onExplanationAdded,
}) {
  const [question, setQuestion] = useState(initialQ);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(initialQ.qtext || "");
  const [editScript, setEditScript] = useState(initialQ.qscript || "");
  const [saving, setSaving] = useState(false);
  const [showWriteForm, setShowWriteForm] = useState(false);

  // ex prop 갱신 동기화
  useEffect(() => {
    setQuestion(initialQ);
  }, [initialQ.id]);

  // 이 문제의 해설들 (carousel 내부에서 다시 sort 됨)
  const myExps = useMemo(() => {
    return explanations.filter((ex) => {
      const qId = ex.question?.id ?? ex.question;
      return qId === question.id;
    });
  }, [explanations, question.id]);

  const openEdit = () => {
    setEditText(question.qtext || "");
    setEditScript(question.qscript || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editText.trim()) {
      message.warning("문제 내용을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      await AxiosInstance.patch(`question/${question.id}/`, {
        qtext: editText,
        qscript: editScript || "",
      });
      setQuestion((prev) => ({ ...prev, qtext: editText, qscript: editScript }));
      message.success("문제가 수정되었습니다.");
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      message.error("수정 실패: " + (e?.response?.data?.detail || e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const examIdParam = question.exam?.id ?? question.exam ?? "";
  const enIdParam = question.examnumber?.id ?? question.examnumber ?? "";

  return (
    <Card
      size="small"
      styles={{ body: { padding: 14 } }}
      style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
            문제 {question.qnumber}번
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.5 }}>
            {question.qtext}
          </div>
          {question.qscript && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, whiteSpace: "pre-wrap" }}>
              {question.qscript}
            </div>
          )}
        </div>
        <Space size={4} direction="vertical" align="end">
          <Tooltip title="문제 본문의 오탈자를 정정합니다">
            <Button size="small" icon={<ToolOutlined />} onClick={openEdit}>
              문제 수정
            </Button>
          </Tooltip>
          <Button
            size="small"
            type={showWriteForm ? "default" : "primary"}
            icon={<EditOutlined />}
            onClick={() => setShowWriteForm((v) => !v)}
          >
            {showWriteForm ? "닫기" : "해설 작성"}
          </Button>
        </Space>
      </div>

      <div style={{ marginTop: 12 }}>
        {showWriteForm ? (
          <StudyWriteExplanation
            inlineMode
            examList={examObj ? [examObj] : []}
            examNumberList={allExamnumbers}
            questionList={questions}
            mainsubjectList={mainsubjects}
            detailsubjectList={detailsubjects}
            initialExamId={examIdParam}
            initialExamnumberId={enIdParam}
            initialQuestionId={question.id}
            onSave={(newExp) => {
              onExplanationAdded?.(newExp);
              setShowWriteForm(false);
            }}
            onCancel={() => setShowWriteForm(false)}
          />
        ) : (
          <ExplanationCarousel explanations={myExps} user={user} />
        )}
      </div>

      {/* 문제 수정 모달 */}
      <Modal
        title={`문제 ${question.qnumber}번 수정 (오탈자 정정)`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={saveEdit}
        okText="저장"
        cancelText="취소"
        confirmLoading={saving}
        width={680}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>문제 본문 (qtext)</Text>
          <Input.TextArea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={1000}
            showCount
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>부가 설명 (qscript, 선택)</Text>
          <Input.TextArea
            value={editScript}
            onChange={(e) => setEditScript(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={1000}
            showCount
          />
        </div>
      </Modal>
    </Card>
  );
}

// =====================================================================
// QuickAddQuestion — StudyView 모달 안 inline 문제 등록 폼
// ---------------------------------------------------------------------
// · 시험명·시험회차는 현재 보고 있는 examnumber 에서 자동 설정 (수정 불가)
// · 사용자 입력: 과목(교시) / 문항번호 / 본문 / qtype
// · 누락된 ExamQsubject 가 필요하면 자동으로 생성
// =====================================================================
function QuickAddQuestion({ examnumber, examLabel, usedQsubjects, onCreated }) {
  const [qsId, setQsId]       = useState(null);
  const [qnumber, setQnumber] = useState(1);
  const [qtext, setQtext]     = useState("");
  const [qscript, setQscript] = useState("");
  const [qtype, setQtype]     = useState("Sj");
  const [saving, setSaving]   = useState(false);

  // 기술사 여부 — examname 으로 추정
  const examNameForLabel = examnumber?.exam_name || examnumber?.exam?.examname || "";
  const isEngineer = examNameForLabel.includes("기술사");

  // 과목(교시) 옵션
  const qsubjectOptions = useMemo(() => {
    return (usedQsubjects || []).map((qs) => {
      const hasEst = !!(qs?.est && String(qs.est).trim());
      const label = hasEst ? `${qs.esn}. ${qs.est}` : `${qs.esn}교시`;
      return { value: qs.id, label };
    });
  }, [usedQsubjects]);

  // 등록된 과목이 0개일 때 안내
  const hasNoQsubject = qsubjectOptions.length === 0;

  const submit = async () => {
    if (!qsId) return message.warning("과목(교시)를 선택하세요.");
    if (!qnumber || qnumber < 1) return message.warning("문항 번호는 1 이상.");
    if (!qtext.trim()) return message.warning("문제 본문을 입력하세요.");

    setSaving(true);
    try {
      const examIdLocal = examnumber.exam?.id ?? examnumber.exam;
      const res = await AxiosInstance.post("question/", {
        exam: examIdLocal,
        examnumber: examnumber.id,
        examqsubject_id: qsId,
        qtype,
        qnumber: Number(qnumber),
        qtext: qtext.slice(0, 1000),
        qscript: qscript ? qscript.slice(0, 1000) : "",
      });
      message.success("문제가 등록되었습니다.");
      onCreated?.(res.data);
      // 초기화
      setQtext("");
      setQscript("");
      setQnumber((n) => Number(n) + 1);
    } catch (e) {
      const detail =
        e?.response?.data
          ? (typeof e.response.data === "string"
              ? e.response.data
              : JSON.stringify(e.response.data))
          : e?.message;
      message.error("등록 실패: " + detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* 잠긴(read-only) 컨텍스트 표시 */}
      <div
        style={{
          marginBottom: 12,
          padding: 10,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
        }}
      >
        <Space wrap>
          <Tag color="blue">시험명</Tag>
          <Text strong>{examLabel}</Text>
          <Tag color="green">회차</Tag>
          <Text strong>{examnumber.year}({examnumber.examnumber}회)</Text>
          {isEngineer && <Tag color="purple">기술사</Tag>}
        </Space>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
          ⓘ 시험명·회차는 현재 보고 있는 회차로 자동 설정되어 수정할 수 없습니다.
        </div>
      </div>

      {hasNoQsubject ? (
        <Alert
          type="warning"
          showIcon
          message="이 회차에 등록된 과목(교시)이 없습니다."
          description="먼저 시험 등록 페이지에서 과목(교시)을 등록해야 문제를 추가할 수 있습니다."
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px", gap: 8, marginBottom: 10 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>과목(교시) *</Text>
              <Select
                style={{ width: "100%" }}
                value={qsId}
                onChange={setQsId}
                options={qsubjectOptions}
                placeholder="과목(교시) 선택"
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>문항 번호 *</Text>
              <InputNumber
                style={{ width: "100%" }}
                value={qnumber}
                onChange={(v) => setQnumber(v || 1)}
                min={1}
                max={99}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>유형</Text>
              <Select
                style={{ width: "100%" }}
                value={qtype}
                onChange={setQtype}
                options={[
                  { value: "Sj", label: "주관식" },
                  { value: "Oj", label: "객관식" },
                ]}
              />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>문제 본문 *</Text>
            <Input.TextArea
              value={qtext}
              onChange={(e) => setQtext(e.target.value)}
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={1000}
              showCount
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>부가 설명 (선택)</Text>
            <Input.TextArea
              value={qscript}
              onChange={(e) => setQscript(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 6 }}
              maxLength={1000}
              showCount
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <Button type="primary" onClick={submit} loading={saving} icon={<PlusOutlined />}>
              문제 등록
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default StudyView;
