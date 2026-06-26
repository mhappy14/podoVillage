// =====================================================================
// ExplanationCarousel.jsx — 한 문제의 여러 해설 가로 carousel
// ---------------------------------------------------------------------
// 정렬: 좋아요(desc) → 북마크(desc) → 등록일(asc, 빠른 순)
// 레이아웃 (사용자 요청):
//   · 첫 화면(index 0): 현재 해설 95% 단독 노출
//   · 화살표 → 클릭으로 index N (>0) 이동:
//        좌측 이전 5% peek + 현재 90% + 우측 다음 5% peek
//   · index N 이 마지막이고 다음이 없으면 → 현재 95% (peek 없음)
// 애니메이션: width / transform 둘 다 CSS transition (300ms ease)
// =====================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Tag, Tooltip, Typography, message } from "antd";
import {
  HeartOutlined,
  HeartFilled,
  StarOutlined,
  StarFilled,
  LeftOutlined,
  RightOutlined,
  CommentOutlined,
  EditOutlined,
} from "@ant-design/icons";
import DOMPurify from "dompurify";
import parseWikiSyntax from "./WikiParser";
import AxiosInstance from "./AxiosInstance";
import Comments from "./Comments";
// WikiEditTabs.jsx 의 모든 컴포넌트를 불러와 카드 안에서 자유롭게 배치한다.
import WikiEditTabs, {
  WIKI_TABS,
  WikiEditInput,
  WikiPreview,
  WikiGuidePanel,
  WikiTabBar,
  WikiSaveButton,
  WikiEditBody,
} from "./WikiEditTabs";

const { Text } = Typography;

// 카드 본문 영역의 최대 높이 (가로폭의 ~75% 비율 유지)
const CARD_BODY_MAXH = 360;

export default function ExplanationCarousel({ explanations, user }) {
  // 사용자 요청 정렬: 좋아요(desc) → 북마크(desc) → 등록일(asc)
  const sorted = useMemo(() => {
    const arr = explanations ? explanations.slice() : [];
    return arr.sort((a, b) => {
      const dl = (b.like_count || 0) - (a.like_count || 0);
      if (dl !== 0) return dl;
      const db = (b.bookmark_count || 0) - (a.bookmark_count || 0);
      if (db !== 0) return db;
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return at - bt; // 빠른(오래된) 순
    });
  }, [explanations]);

  // 0건 처리
  if (!sorted || sorted.length === 0) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px dashed #d1d5db",
          borderRadius: 8,
          padding: 28,
          textAlign: "center",
          color: "#9ca3af",
          fontSize: 13,
        }}
      >
        아직 작성된 답안이 없습니다.
      </div>
    );
  }

  return <CarouselInner explanations={sorted} user={user} />;
}

function CarouselInner({ explanations, user }) {
  const [index, setIndex] = useState(0);
  const total = explanations.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  // 레이아웃 비율 결정 (사용자 요구):
  //   · index === 0  → [현재 95%]
  //   · 0 < index < total-1 → [이전 5%][현재 90%][다음 5%]
  //   · index === total-1 (>0) → [이전 5%][현재 95%]
  //   · total === 1 → [현재 95%]
  const layout = useMemo(() => {
    if (total === 1) return { prev: 0, cur: 90, next: 0 };
    if (index === 0) return { prev: 0, cur: 90, next: 8 };
    if (index === total - 1) return { prev: 8, cur: 90, next: 0 };
    return { prev: 7, cur: 85, next: 7 };
  }, [index, total]);

  const prevExp = hasPrev ? explanations[index - 1] : null;
  const curExp = explanations[index];
  const nextExp = hasNext ? explanations[index + 1] : null;

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* 메인 영역 — 3개의 패널이 가로로 배치되며 width 가 동적으로 변함 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {/* 좌측 peek */}
        <div
          style={{
            width: `${layout.prev}%`,
            flexShrink: 0,
            transition: "width 300ms ease",
            overflow: "hidden",
            opacity: layout.prev > 0 ? 0.45 : 0,
            cursor: hasPrev ? "pointer" : "default",
            position: "relative",
          }}
          onClick={() => hasPrev && setIndex((i) => Math.max(0, i - 1))}
        >
          {prevExp && (
            <PeekCard ex={prevExp} side="left" />
          )}
        </div>

        {/* 현재 해설 */}
        <div
          style={{
            width: `${layout.cur}%`,
            flexShrink: 0,
            transition: "width 300ms ease, transform 300ms ease",
          }}
          key={curExp.id /* 인덱스 변경 시 key 바꿔 fade-in 효과 */}
          className="ec-current-fadein"
        >
          <ExplanationCard ex={curExp} rank={index + 1} user={user} />
        </div>

        {/* 우측 peek */}
        <div
          style={{
            width: `${layout.next}%`,
            flexShrink: 0,
            transition: "width 300ms ease",
            overflow: "hidden",
            opacity: layout.next > 0 ? 0.45 : 0,
            cursor: hasNext ? "pointer" : "default",
            position: "relative",
          }}
          onClick={() => hasNext && setIndex((i) => Math.min(total - 1, i + 1))}
        >
          {nextExp && (
            <PeekCard ex={nextExp} side="right" />
          )}
        </div>
      </div>

      {/* 좌측 화살표 */}
      {hasPrev && (
        <ArrowButton direction="left" onClick={() => setIndex((i) => Math.max(0, i - 1))} />
      )}

      {/* 우측 화살표 — 다음 있음 암시 펄스 */}
      {hasNext && (
        <ArrowButton direction="right" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} pulse />
      )}

      {/* 인디케이터 (점) */}
      {total > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {explanations.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => setIndex(i)}
              title={`${i + 1}번째 해설`}
              style={{
                width: i === index ? 18 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                background: i === index ? "#1677ff" : "#d1d5db",
                cursor: "pointer",
                transition: "width 200ms ease, background 200ms ease",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* keyframes */}
      <style>{`
        @keyframes ec-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,119,255,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(22,119,255,0); }
        }
        @keyframes ec-slide {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(4px); }
        }
        @keyframes ec-fadein {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .ec-arrow-pulse {
          animation: ec-pulse 1.6s ease-out infinite, ec-slide 1.4s ease-in-out infinite;
        }
        .ec-current-fadein {
          animation: ec-fadein 280ms ease-out;
        }
      `}</style>
    </div>
  );
}

// ---------- 작은 peek 카드 (좌/우 5%) ----------
function PeekCard({ ex, side }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 180,
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "#f3f4f6",
        padding: "8px 6px",
        overflow: "hidden",
        position: "relative",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          fontWeight: 600,
          [side === "left" ? "textAlign" : "textAlign"]: "center",
        }}
      >
        {side === "left" ? "◀ 이전" : "다음 ▶"}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#374151",
          marginTop: 4,
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        ❤ {ex.like_count || 0}
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
        {ex?.nickname?.nickname || "익명"}
      </div>
    </div>
  );
}

// ---------- 화살표 버튼 ----------
function ArrowButton({ direction, onClick, pulse = false }) {
  const isRight = direction === "right";
  return (
    <Tooltip title={isRight ? "다음 해설 보기" : "이전 해설 보기"}>
      <button
        onClick={onClick}
        className={pulse ? "ec-arrow-pulse" : ""}
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          [isRight ? "right" : "left"]: 8,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #1677ff, #0958d9)",
          color: "#fff",
          cursor: "pointer",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          boxShadow: "0 4px 12px rgba(22,119,255,0.35)",
        }}
      >
        {isRight ? <RightOutlined /> : <LeftOutlined />}
      </button>
    </Tooltip>
  );
}

// ---------- 개별 해설 카드 ----------
function ExplanationCard({ ex, rank, user }) {
  const [data, setData] = useState(ex);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [editContent, setEditContent] = useState(ex.explanation || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTab, setEditTab] = useState("edit"); // 편집/미리보기/문법 도움말

  // ex prop 이 바뀌면 동기화
  useEffect(() => {
    setData(ex);
    setComments([]);
    setShowComments(false);
    setEditContent(ex.explanation || "");
    setEditing(false);
    setEditTab("edit");
  }, [ex.id]);

  const isAuthor = user && data?.nickname?.id && user.id === data.nickname.id;
  const isLoggedIn = !!user;

  const sanitized = useMemo(() => {
    if (!data?.explanation) return "";
    const html = parseWikiSyntax(data.explanation);
    return DOMPurify.sanitize(html);
  }, [data?.explanation]);

  useEffect(() => {
    if (!showComments) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await AxiosInstance.get("comment/");
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filtered = list.filter(
          (c) => c?.explanation?.id === data.id || c?.explanation === data.id
        );
        if (!cancelled) setComments(filtered);
      } catch (e) {
        console.warn("댓글 로드 실패:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [showComments, data.id]);

  const toggleLike = async () => {
    if (!isLoggedIn) return message.warning("로그인이 필요합니다.");
    try {
      if (data.is_liked) {
        await AxiosInstance.delete(`explanation/${data.id}/unlike/`);
        setData((p) => ({ ...p, is_liked: false, like_count: Math.max(0, (p.like_count || 1) - 1) }));
      } else {
        await AxiosInstance.post(`explanation/${data.id}/like/`);
        setData((p) => ({ ...p, is_liked: true, like_count: (p.like_count || 0) + 1 }));
      }
    } catch {
      message.error("좋아요 처리 실패");
    }
  };

  const toggleBookmark = async () => {
    if (!isLoggedIn) return message.warning("로그인이 필요합니다.");
    try {
      if (data.is_bookmarked) {
        await AxiosInstance.delete(`explanation/${data.id}/unbookmark/`);
        setData((p) => ({ ...p, is_bookmarked: false, bookmark_count: Math.max(0, (p.bookmark_count || 1) - 1) }));
      } else {
        await AxiosInstance.post(`explanation/${data.id}/bookmark/`);
        setData((p) => ({ ...p, is_bookmarked: true, bookmark_count: (p.bookmark_count || 0) + 1 }));
      }
    } catch {
      message.error("북마크 처리 실패");
    }
  };

  const submitComment = async () => {
    if (!isLoggedIn) return message.warning("로그인이 필요합니다.");
    if (!comment.trim()) return message.warning("댓글 내용을 입력하세요.");
    try {
      const res = await AxiosInstance.post("comment/", {
        content: comment,
        explanation: data.id,
      });
      setComments((p) => [...p, res.data]);
      setComment("");
    } catch {
      message.error("댓글 작성 실패");
    }
  };

  // 작성자 인라인 편집 저장 (StudyEdit 이동 없이 카드 안에서 PATCH)
  const handleInlineSave = async (values) => {
    const next = values?.content ?? editContent;
    setSavingEdit(true);
    try {
      await AxiosInstance.patch(`explanation/${data.id}/`, { explanation: next });
      setData((p) => ({ ...p, explanation: next }));
      setEditContent(next);
      setEditing(false);
      message.success("해설이 수정되었습니다.");
    } catch {
      message.error("해설 수정 실패");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Card
      size="small"
      styles={{ body: { padding: "0.5rem" } }}
      style={{
        height: "100%",
        background: "#fff",
        border: rank === 1 ? "1px solid #1677ff" : "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div>
          {rank === 1 && <Tag color="gold">👑 BEST</Tag>}
          <Text type="secondary" style={{ fontSize: 11 }}>
            #{rank} 해설 · {data?.nickname?.nickname || "익명"}
          </Text>
        </div>
        {isAuthor && editing && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <WikiTabBar activeKey={editTab} onChange={setEditTab} thirds />
            <Button
              size="small"
              onClick={() => {
                setEditing(false);
                setEditContent(data.explanation || "");
                setEditTab("edit");
              }}
            >
              취소
            </Button>
            <WikiSaveButton
              size="small"
              content={editContent}
              loading={savingEdit}
              onSave={(c) => handleInlineSave({ content: c })}
            />
          </div>
        )}
        {isAuthor && (
          <Button
            size="small"
            type={editing ? "primary" : "text"}
            icon={<EditOutlined />}
            onClick={() => setEditing((v) => !v)}
          />
        )}
      </div>

      {isAuthor && editing ? (
        <div style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
          {/* 입력창 / 미리보기 / 도움말 본문 */}
          <div style={{ marginTop: 6 }}>
            <WikiEditBody
              activeKey={editTab}
              content={editContent}
              onContentChange={setEditContent}
              rows={10}
              inputStyle={{ fontSize: "0.75rem" }}
              previewStyle={{
                border: "1px solid #f0f0f0",
                borderRadius: 6,
                background: "#fafafa",
                padding: "0.5rem 1rem",
                minHeight: 120,
                fontSize: "0.75rem",
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      ) : (
        <div
          className="wiki-body"
          style={{
            marginTop: "0.25rem",
            padding: "0.25rem 1rem 0.25rem 1rem",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
            background: "#fafafa",
            height: "auto",
            minHeight: 120,
            overflowY: "visible",
            fontSize: "0.75rem",
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}

      {(data?.mainsubject?.length || data?.detailsubject?.length) ? (
        <div style={{ marginTop: 6 }}>
          {(data?.mainsubject || []).slice(0, 2).map((s) => (
            <Tag key={s.id} color="blue" style={{ fontSize: 10 }}>{s?.mainslug}</Tag>
          ))}
          {(data?.detailsubject || []).slice(0, 2).map((s) => (
            <Tag key={s.id} color="cyan" style={{ fontSize: 10 }}>{s?.detailslug}</Tag>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
        <Button
          size="small"
          type={data.is_liked ? "primary" : "default"}
          danger={data.is_liked}
          icon={data.is_liked ? <HeartFilled /> : <HeartOutlined />}
          onClick={toggleLike}
        >
          {data.like_count || 0}
        </Button>
        <Button
          size="small"
          type={data.is_bookmarked ? "primary" : "default"}
          icon={data.is_bookmarked ? <StarFilled /> : <StarOutlined />}
          onClick={toggleBookmark}
        >
          {data.bookmark_count || 0}
        </Button>
        <Button
          size="small"
          icon={<CommentOutlined />}
          onClick={() => setShowComments((v) => !v)}
        >
          댓글
        </Button>
      </div>

      {showComments && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0f0f0" }}>
          <Comments
            filteredComments={comments}
            comment={comment}
            loggedIn={isLoggedIn}
            handleCommentChange={(e) => setComment(e.target.value)}
            handleCommentSubmit={submitComment}
          />
        </div>
      )}
    </Card>
  );
}
