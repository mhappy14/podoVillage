// src/WikiVersionList.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { List, Typography, Spin, Alert, Space, Button } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

// /wiki/v/<title>/versions 형태에서도 동작하도록 보강 파서
function extractTitleFromPath(pathname) {
  // 우선순위: /wiki/v/<title>/versions
  const m = pathname.match(/^\/wiki\/v\/(.+?)\/versions\/?$/);
  if (m) return decodeURIComponent(m[1]);
  // 폴백: /wiki/view/<title>/versions (예전 경로 호환)
  const m2 = pathname.match(/^\/wiki\/view\/(.+?)\/versions\/?$/);
  if (m2) return decodeURIComponent(m2[1]);
  return '';
}

const normalizeUrl = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const page = u.searchParams.get('page') || '1';
    return `?page=${page}`;
  } catch {
    return url;
  }
};

const WikiVersionList = () => {
  const params = useParams();
  const location = useLocation();
  // params.title이 없을 수 있어, pathname에서 안전하게 추출
  const decodedTitle = decodeURIComponent(
    (params.title ?? '').trim() || extractTitleFromPath(location.pathname)
  );

  const [versions, setVersions] = useState([]);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);

  const fetchVersions = async (pageQuery = '') => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await AxiosInstance.get(`/wiki/${slug}/versions/${pageQuery}`);
      setVersions(res.data.results ?? res.data);
      setNextUrl(normalizeUrl(res.data.next));
      setPrevUrl(normalizeUrl(res.data.previous));
    } catch (e) {
      setError('버전 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const pageRes = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(decodedTitle)}/`);
        if (!pageRes.data.slug) throw new Error();
        setSlug(pageRes.data.slug);
      } catch {
        setError('문서를 찾을 수 없습니다.');
        setLoading(false);
      }
    };
    run();
  }, [decodedTitle]);

  useEffect(() => {
    if (slug) fetchVersions();
  }, [slug]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto' }}>
      <Title level={3}>
        <Link
          to={`/wiki/v/${encodeURIComponent(decodedTitle)}`}
          className="wiki-title-link"
          aria-label={`${decodedTitle} 문서 보기`}
        >
        {decodedTitle}
      </Link> - 버전 목록</Title>
      <List
        bordered
        dataSource={versions}
        renderItem={(item) => (
          <List.Item>
            <Link to={`/wiki/v/${encodeURIComponent(decodedTitle)}/versionslist/${item.id}`}>
              버전 {item.id} - {new Date(item.edited_at).toLocaleString()} - {item.nickname_username || '익명'}
            </Link>
          </List.Item>
        )}
      />
      <Space style={{ marginTop: '1rem' }}>
        <Button onClick={() => prevUrl && fetchVersions(prevUrl)} disabled={!prevUrl}>이전</Button>
        <Button onClick={() => nextUrl && fetchVersions(nextUrl)} disabled={!nextUrl}>다음</Button>
        <Link to={`/wiki/v/${encodeURIComponent(decodedTitle)}`} style={{ marginLeft: 12 }}>← 최신 문서로</Link>
      </Space>
    </div>
  );
};

export default WikiVersionList;
