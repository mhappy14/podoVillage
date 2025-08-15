// src/WikiView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Button, Spin, Alert, Space, Tag, message } from 'antd';

const { Title, Paragraph } = Typography;

export default function WikiView() {
  const { '*': titlePath } = useParams();
  const title = decodeURIComponent(titlePath || '').trim();

  const [page, setPage] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem('Token');
  const navigate = useNavigate();
  const location = useLocation();
  const flashedRef = useRef(false);

  useEffect(() => {
    if (!flashedRef.current && location.state?.justSaved) {
      flashedRef.current = true;
      message.success('최신 버전으로 업데이트되었습니다.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!title) {
        setError('잘못된 문서 주소입니다. 제목이 비어 있습니다.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setPage(null);
      setLatestVersion(null);
      setMissing(false);

      try {
        const pageRes = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(title)}/`);
        if (!alive) return;
        const pageData = pageRes?.data;
        if (!pageData || !pageData.slug) {
          setMissing(true);
          setPage({ title, content: '' });
          return;
        }
        setPage(pageData);
        try {
          const latestRes = await AxiosInstance.get(`/wiki/${pageData.slug}/latest-version/`);
          if (!alive) return;
          setLatestVersion(latestRes?.data && !latestRes.data.detail ? latestRes.data : null);
        } catch { setLatestVersion(null); }
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 404) {
          setMissing(true);
          setPage({ title, content: '' });
        } else {
          const msg =
            e?.response?.data?.detail ||
            (typeof e?.response?.data === 'string' ? e.response.data : '') ||
            e?.message || '문서 로딩 중 오류가 발생했습니다.';
          setError(msg);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [title]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;

  if (error) {
    return (
      <Alert
        message="문서를 표시할 수 없습니다."
        description={<div><div style={{ marginBottom: 8 }}>{error}</div><div><b>요청한 제목:</b> {title}</div></div>}
        type="error"
        showIcon
        style={{ marginTop: '2rem' }}
      />
    );
  }

  const contentHtml = parseWikiSyntax(latestVersion?.content ?? page?.content ?? '');
  const versionBadge = latestVersion
    ? `v${latestVersion.id} • ${new Date(latestVersion.edited_at).toLocaleString()}`
    : (missing ? '문서 없음' : '초기본/버전 없음');

  const handleContentClick = (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('/wiki/v/')) {
      e.preventDefault();
      const url = new URL(href, window.location.origin);
      const rawTail = decodeURIComponent(url.pathname.replace(/^\/wiki\/v\//, ''));
      navigate(`/wiki/v/${rawTail}`);
    }
  };

  return (
    <Card
      title={<Title level={3}>{page?.title || title}</Title>}
      extra={
        <Space wrap>
          <Tag color="default">{versionBadge}</Tag>
          <Button onClick={() => navigate(`/wiki/v/${encodeURIComponent(title)}/versionslist`)} disabled={missing}>
            버전 목록 보기
          </Button>
          <Button
            type="primary"
            onClick={() =>
              navigate(`/wiki/${encodeURIComponent(title)}/edit`, { state: { allowEdit: true } })
            }
            disabled={!isLoggedIn}
          >
            {isLoggedIn ? (missing ? '문서 만들기' : '수정') : '수정(로그인필요)'}
          </Button>
        </Space>
      }
      style={{ marginTop: '2rem' }}
    >
      <Paragraph>
        {missing ? (
          <div style={{ lineHeight: 1.8 }}>
            <div style={{ marginBottom: 12, color: '#64748b' }}>작성되지 않은 문서입니다.</div>
            <Button
              type="dashed"
              onClick={() =>
                navigate(`/wiki/${encodeURIComponent(title)}/edit`, { state: { allowEdit: true } })
              }
              disabled={!isLoggedIn}
            >
              {isLoggedIn ? '이 문서를 새로 작성하기' : '로그인 후 작성할 수 있습니다'}
            </Button>
          </div>
        ) : (
          <div
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
            style={{ whiteSpace: 'pre-wrap' }}
          />
        )}
      </Paragraph>
    </Card>
  );
}
