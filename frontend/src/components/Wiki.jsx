import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Button, Spin, Alert, Space, Tag, message } from 'antd';

const { Title, Paragraph } = Typography;

const WikiView = () => {
  // /wiki/view/* 에서 * = 제목 전체(슬래시 포함)
  const { '*': titlePath } = useParams();
  const title = decodeURIComponent(titlePath || '').trim();

  const [page, setPage] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem('Token');
  const navigate = useNavigate();
  const location = useLocation();
  const flashedRef = useRef(false);

  // 저장 후 돌아온 경우 메시지
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
      // 제목 비어있으면 즉시 안내
      if (!title) {
        setError('잘못된 문서 주소입니다. 제목이 비어 있습니다.');
        setPage(null);
        setLatestVersion(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPage(null);
      setLatestVersion(null);

      try {
        // 1) 제목 → 페이지(=slug 확보)
        const byTitleUrl = `/wiki/by-title/${encodeURI(title)}/`;
        // console.debug('[WikiView] by-title URL:', byTitleUrl);
        const pageRes = await AxiosInstance.get(byTitleUrl);
        if (!alive) return;
        const pageData = pageRes?.data;
        if (!pageData || !pageData.slug) {
          setError('문서를 찾을 수 없습니다.');
          setPage(null);
          return;
        }
        setPage(pageData);

        // 2) 최신 버전(있으면)
        try {
          const latestRes = await AxiosInstance.get(`/wiki/${pageData.slug}/latest-version/`);
          if (!alive) return;
          if (latestRes?.data && !latestRes.data.detail) {
            setLatestVersion(latestRes.data);
          } else {
            setLatestVersion(null);
          }
        } catch (e) {
          // 최신버전 없을 수 있음 → 경고 띄우되 뷰는 진행
          // console.warn('[WikiView] latest-version fetch failed:', e);
          setLatestVersion(null);
        }
      } catch (e) {
        if (!alive) return;
        // 상태코드/메시지 최대한 사용자에게 보여주기 (response 없을 수도 있음)
          const status = e?.response?.status;
          const respData = e?.response?.data;
          const detailFromResp =
            (respData && (respData.detail || (typeof respData === 'string' ? respData : null))) || null;
          const fallbackMsg = e?.message || '문서 로딩 중 오류가 발생했습니다.';

          if (status === 404) {
            setError(detailFromResp || '문서를 찾을 수 없습니다. (404)');
          } else if (status === 403) {
            setError(detailFromResp || '접근 권한이 없습니다. (403)');
          } else {
            setError(detailFromResp || fallbackMsg);
          }
        setPage(null);
        setLatestVersion(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => { alive = false; };
  }, [title]);

  // 로딩
  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;

  // 에러(404/권한/기타) → 빈 화면 대신 안내
  if (error) {
    return (
      <Alert
        message="문서를 표시할 수 없습니다."
        description={
          <div>
            <div style={{ marginBottom: 8 }}>{error}</div>
            {title && <div><b>요청한 제목:</b> {title}</div>}
          </div>
        }
        type="error"
        showIcon
        style={{ marginTop: '2rem' }}
      />
    );
  }

  // page가 없을 경우에도 경고 노출(이제는 거의 안 올 것)
  if (!page) {
    return (
      <Alert
        message="문서를 찾을 수 없습니다."
        description={title}
        type="warning"
        showIcon
        style={{ marginTop: '2rem' }}
      />
    );
  }

  const contentHtml = parseWikiSyntax(latestVersion?.content ?? page.content);
  const versionBadge = latestVersion
    ? `v${latestVersion.id} • ${new Date(latestVersion.edited_at).toLocaleString()}`
    : '초기본/버전 없음';

  // 본문 내 내부 링크(`/wiki/view/...`)는 SPA 네비게이션으로 처리
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
          {/* 상대 경로로 연결: 부모의 /wiki/view/<제목...> 밑으로 붙음 */}
          <Link to="versions">
            <Button>버전 목록 보기</Button>
          </Link>
          <Link to={isLoggedIn ? `/wiki/edit/${page.slug}` : '#'}>
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
