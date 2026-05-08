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
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  BookOutlined,
  EditOutlined,
} from "@ant-design/icons";
import AxiosInstance from "./AxiosInstance";
import ExplanationCarousel from "./ExplanationCarousel";

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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]); // collapse 상태

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [enRes, allEnRes, qRes, qsRes, exRes] = await Promise.all([
          AxiosInstance.get(`examnumber/${examnumberId}/`),
          AxiosInstance.get("examnumber/"),
          AxiosInstance.get("question/"),
          AxiosInstance.get("examqsubject/"),
          AxiosInstance.get("explanation/"),
        ]);
        if (cancelled) return;
        setExamnumber(enRes.data);
        setAllExamnumbers(asArray(allEnRes.data));
        setQuestions(asArray(qRes.data));
        setQsubjects(asArray(qsRes.data));
        setExplanations(asArray(exRes.data));

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

  const examLabel = useMemo(() => renderExamLabel(examnumber?.exam), [examnumber]);

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
    <div style={{ padding: "1rem 1.25rem" }}>
      {/* ===== 회차 네비게이션 바 ===== */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: "10px 14px" } }}
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
          <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1 }}>
              <Link to="/study" style={{ color: "#1677ff" }}>
                <BookOutlined /> 시험 목록
              </Link>{" "}
              · {sameExamSiblings.length}개 회차 등록됨
            </div>
            <Title level={3} style={{ margin: "2px 0 0 0" }}>
              {examLabel}
            </Title>
            <Text type="secondary">
              {examnumber.year}년 {examnumber.examnumber}회
            </Text>
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
            <Link to="/study/write"><Button type="primary">문제 등록</Button></Link>
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
                    />
                  ))}
                </div>
              ),
            };
          })}
        />
      )}
    </div>
  );
};

// ---------- 한 문제 + 해설 carousel ----------
function QuestionBlock({ question, explanations, user }) {
  // 이 문제의 해설들 — 좋아요 desc → 북마크 desc → 등록일 asc (가장 먼저 작성된 게 우선)
  const myExps = useMemo(() => {
    const list = explanations.filter((ex) => {
      const qId = ex.question?.id ?? ex.question;
      return qId === question.id;
    });
    return list.slice().sort((a, b) => {
      const dl = (b.like_count || 0) - (a.like_count || 0);
      if (dl !== 0) return dl;
      const db = (b.bookmark_count || 0) - (a.bookmark_count || 0);
      if (db !== 0) return db;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });
  }, [explanations, question.id]);

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
        <Link to={`/study/write?question=${question.id}`}>
          <Button size="small" icon={<EditOutlined />}>
            해설 작성
          </Button>
        </Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <ExplanationCarousel explanations={myExps} user={user} />
      </div>
    </Card>
  );
}

export default StudyView;
