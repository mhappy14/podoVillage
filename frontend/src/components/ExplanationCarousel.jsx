// =====================================================================
// ExplanationCarousel.jsx — 한 문제의 여러 해설을 가로 스크롤 (좋아요순)
// ---------------------------------------------------------------------
// · 좋아요 내림차순 정렬 (이미 부모에서 처리)
// · 가로 carousel — 화살표 버튼으로 한 칸씩 이동 (마우스 휠 사용 X)
// · 우측 화살표가 펄스/슬라이드 애니메이션으로 "다음 해설 있음" 암시
// · 각 해설 카드: 좋아요/북마크 토글 + 댓글 영역
// · 해설 0개일 때 "아직 작성된 답안이 없습니다" 표시
// =====================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Tag, Tooltip, Typography, message, Empty, Space } from "antd";
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
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import parseWikiSyntax from "./WikiParser";
import AxiosInstance from "./AxiosInstance";
import Comments from "./Comments";

const { Text } = Typography;

const CARD_WIDTH = 630;       // 1.5배 확대 (기존 420 × 1.5)
const CARD_GAP = 12;          // 카드 사이 간격
const CARD_BODY_MAXH = 330;   // 카드 본문 영역 max-height (기존 220 × 1.5)
const PEEK_WIDTH = 60;        // 다음 카드 일부 노출 폭 (사용자 요청)

export default function ExplanationCarousel({ explanations, user }) {
  // 0건 처리 — 사용자 요구사항: "아직 작성된 답안이 없습니다"
  if (!explanations || explanations.length === 0) {
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

  return (
    <CarouselInner explanations={explanations} user={user} />
  );
}

function CarouselInner({ explanations, user }) {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [explanations.length]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (CARD_WIDTH + CARD_GAP), behavior: "smooth" });
  };

  return (
    <div style={{ position: "relative" }}>
      {/* 좌측 화살표 — 스크롤 시 노출 */}
      {canScrollLeft && (
        <ArrowButton direction="left" onClick={() => scrollBy(-1)} />
      )}

      {/* 가로 스크롤러 — paddingRight 로 마지막 카드 뒤에 peek 공간 확보 */}
      <div
        ref={scrollerRef}
        style={{
          display: "flex",
          gap: CARD_GAP,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "thin",
          paddingBottom: 4,
          // 다음 카드 일부 노출을 위해 컨테이너의 max-width 를 (CARD_WIDTH + PEEK_WIDTH + GAP) 로
          // 제한하지 않고, 그 대신 화면이 더 넓을 때만 자연스럽게 1장 + peek 가 보이게 함
          maxWidth: `${CARD_WIDTH + PEEK_WIDTH + CARD_GAP}px`,
        }}
      >
        {explanations.map((ex, idx) => (
          <div key={ex.id} style={{ flex: "0 0 auto", scrollSnapAlign: "start", width: CARD_WIDTH }}>
            <ExplanationCard ex={ex} rank={idx + 1} user={user} />
          </div>
        ))}
      </div>

      {/* 우측 화살표 — 다음 해설 암시 (펄스 + 슬라이드 애니메이션) */}
      {canScrollRight && (
        <ArrowButton direction="right" onClick={() => scrollBy(1)} pulse />
      )}

      {/* 인라인 keyframes */}
      <style>{`
        @keyframes ec-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,119,255,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(22,119,255,0); }
        }
        @keyframes ec-slide {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(4px); }
        }
        .ec-arrow-pulse {
          animation: ec-pulse 1.6s ease-out infinite, ec-slide 1.4s ease-in-out infinite;
        }
      `}</style>
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
          [isRight ? "right" : "left"]: -16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #1677ff, #0958d9)",
          color: "#fff",
          cursor: "pointer",
          zIndex: 10,
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

  const isAuthor = user && data?.nickname?.id && user.id === data.nickname.id;
  const isLoggedIn = !!user;

  const sanitized = useMemo(() => {
    if (!data?.explanation) return "";
    const html = parseWikiSyntax(data.explanation);
    return DOMPurify.sanitize(html);
  }, [data?.explanation]);

  // 댓글 로드 (lazy — 영역 펼칠 때)
  useEffect(() => {
    if (!showComments) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await AxiosInstance.get("comment/");
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filtered = list.filter((c) => c?.explanation?.id === data.id || c?.explanation === data.id);
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
        setData((prev) => ({ ...prev, is_liked: false, like_count: Math.max(0, (prev.like_count || 1) - 1) }));
      } else {
        await AxiosInstance.post(`explanation/${data.id}/like/`);
        setData((prev) => ({ ...prev, is_liked: true, like_count: (prev.like_count || 0) + 1 }));
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
        setData((prev) => ({ ...prev, is_bookmarked: false, bookmark_count: Math.max(0, (prev.bookmark_count || 1) - 1) }));
      } else {
        await AxiosInstance.post(`explanation/${data.id}/bookmark/`);
        setData((prev) => ({ ...prev, is_bookmarked: true, bookmark_count: (prev.bookmark_count || 0) + 1 }));
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
      setComments((prev) => [...prev, res.data]);
      setComment("");
    } catch {
      message.error("댓글 작성 실패");
    }
  };

  return (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
      style={{
        height: "100%",
        background: "#fff",
        border: rank === 1 ? "1px solid #1677ff" : "1px solid #e5e7eb",
      }}
    >
      {/* 상단: 순위 + 작성자 + 수정 버튼 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <Space size={4}>
          {rank === 1 && <Tag color="gold">👑 BEST</Tag>}
          <Text type="secondary" style={{ fontSize: 11 }}>
            #{rank} 해설 · {data?.nickname?.nickname || "익명"}
          </Text>
        </Space>
        {isAuthor && (
          <Link to={`/study/edit/${data.id}`}>
            <Button size="small" type="text" icon={<EditOutlined />} />
          </Link>
        )}
      </div>

      {/* 본문 (위키 파싱) */}
      <div
        className="wiki-preview"
        style={{
          marginTop: 6,
          padding: "8px 10px",
          border: "1px solid #f0f0f0",
          borderRadius: 6,
          background: "#fafafa",
          maxHeight: CARD_BODY_MAXH,
          overflowY: "auto",
          fontSize: 13,
          lineHeight: 1.55,
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />

      {/* 메타: 주요/세부 과목 */}
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

      {/* 액션: 좋아요/북마크/댓글 */}
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

      {/* 댓글 영역 */}
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
