import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { List, Typography, Spin, Alert, Space, Button } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

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
  const { title } = useParams();
  const decodedTitle = decodeURIComponent(title || '').trim();

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
      console.error(e);
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
      <Title level={3}>🕓 버전 목록 - {decodedTitle}</Title>
      <List
        bordered
        dataSource={versions}
        renderItem={(item) => (
          <List.Item>
            <Link to={`/wiki/view/${encodeURIComponent(decodedTitle)}/version/${item.id}`}>
              버전 {item.id} - {new Date(item.edited_at).toLocaleString()} - {item.nickname_username || '익명'}
            </Link>
          </List.Item>
        )}
      />
      <Space style={{ marginTop: '1rem' }}>
        <Button onClick={() => prevUrl && fetchVersions(prevUrl)} disabled={!prevUrl}>이전</Button>
        <Button onClick={() => nextUrl && fetchVersions(nextUrl)} disabled={!nextUrl}>다음</Button>
        <Link to={`/wiki/view/${encodeURIComponent(decodedTitle)}`} style={{ marginLeft: 12 }}>← 최신 문서로</Link>
      </Space>
    </div>
  );
};

export default WikiVersionList;
