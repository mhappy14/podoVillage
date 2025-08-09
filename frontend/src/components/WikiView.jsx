// components/WikiView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Button, Spin, Alert, Space, Tag, message } from 'antd';

const { Title, Paragraph, Text } = Typography;

const WikiView = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
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
      // state 제거해서 새로고침/뒤로가기 시 중복 방지
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleContentClick = (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('/wiki/view/')) {
      e.preventDefault();
      // 절대/상대 케이스 모두 처리
      const url = new URL(href, window.location.origin);
      navigate(`/wiki/view/${decodeURIComponent(url.pathname.split('/').pop())}`);
    }
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const [pageRes, latestRes] = await Promise.all([
          AxiosInstance.get(`/wiki/${slug}/`),
          AxiosInstance.get(`/wiki/${slug}/latest-version/`).catch(() => null),
        ]);
        if (!alive) return;
        setPage(pageRes.data);
        if (latestRes && latestRes.data && !latestRes.data.detail) {
          setLatestVersion(latestRes.data);
        } else {
          setLatestVersion(null); // 최신 버전 없으면 null
        }
      } catch (e) {
        setError('문서를 불러오는 데 실패했습니다.');
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;
  if (!page) return null;

  const contentHtml = parseWikiSyntax(latestVersion?.content ?? page.content);
  const versionBadge = latestVersion
    ? `v${latestVersion.id} • ${new Date(latestVersion.edited_at).toLocaleString()}`
    : '초기본/버전 없음';

  return (
    <Card
      title={<Title level={3}>{page.title}</Title>}
      extra={
        <Space wrap>
          <Tag color="default">{versionBadge}</Tag>
          <Link to={`/wiki/view/${page.slug}/versions`}>
            <Button>버전 목록 보기</Button>
          </Link>
          <Link to={isLoggedIn ? `/wiki/edit/${page.slug}` : '#'}>
            <Button
              type="primary"
              disabled={!isLoggedIn}
            >
              {isLoggedIn ? '수정' : '수정(로그인필요)'}
            </Button>
          </Link>
        </Space>
      }
      style={{ marginTop: '2rem' }}
    >
      <Paragraph>
        <div
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </Paragraph>
    </Card>
  );
};

export default WikiView;
