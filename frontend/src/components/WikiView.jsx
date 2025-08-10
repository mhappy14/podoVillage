import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Button, Spin, Alert, Space, Tag, message } from 'antd';

const { Title, Paragraph } = Typography;

const WikiView = () => {
  const { title } = useParams();
  const decodedTitle = decodeURIComponent(title || '').trim();

  const [page, setPage] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [slug, setSlug] = useState('');
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
        setError('잘못된 문서 주소입니다.');
        setLoading(false);
        return;
      }
      try {
        const pageRes = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(decodedTitle)}/`);
        if (!alive) return;
        setPage(pageRes.data);
        setSlug(pageRes.data.slug);

        try {
          const latestRes = await AxiosInstance.get(`/wiki/${pageRes.data.slug}/latest-version/`);
          if (!alive) return;
          setLatestVersion(latestRes?.data && !latestRes.data.detail ? latestRes.data : null);
        } catch {
          setLatestVersion(null);
        }
      } catch (e) {
        if (!alive) return;
        setError('문서를 불러오는 데 실패했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [title]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;
  if (!page) return <Alert message="문서를 찾을 수 없습니다." type="warning" showIcon style={{ marginTop: '2rem' }} />;

  const contentHtml = parseWikiSyntax(latestVersion?.content ?? page.content);
  const versionBadge = latestVersion
    ? `v${latestVersion.id} • ${new Date(latestVersion.edited_at).toLocaleString()}`
    : '초기본/버전 없음';

  const handleContentClick = (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('/wiki/view/')) {
      e.preventDefault();
      const url = new URL(href, window.location.origin);
      const rawTail = decodeURIComponent(url.pathname.replace(/^\/wiki\/view\//, ''));
      navigate(`/wiki/view/${rawTail}`);
    }
  };

  return (
    <Card
      title={<Title level={3}>{page.title}</Title>}
      extra={
        <Space wrap>
          <Tag color="default">{versionBadge}</Tag>
          <Link to={`/wiki/view/${title}/versions`}>
            <Button>버전 목록 보기</Button>
          </Link>
          <Link to={isLoggedIn ? `/wiki/edit/${title}` : '#'}>
            <Button type="primary" disabled={!isLoggedIn}>
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
