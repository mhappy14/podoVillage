// components/WikiVersionList.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { List, Typography, Spin, Alert, Space, Button } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

const normalizeUrl = (url, slug) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const page = u.searchParams.get('page') || '1';
    return `/wiki/${slug}/versions/?page=${page}`;
  } catch {
    return url; // 이미 상대경로면 그대로
  }
};

const WikiVersionList = () => {
  const { slug } = useParams();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);

  const fetchPage = async (url = `/wiki/${slug}/versions/`) => {
    setLoading(true);
    try {
      const res = await AxiosInstance.get(url);
      setVersions(res.data.results ?? res.data); // pagination 없을 때도 안전
      setNextUrl(normalizeUrl(res.data.next, slug));
      setPrevUrl(normalizeUrl(res.data.previous, slug));
    } catch (e) {
      setError('버전 목록을 불러오는 데 실패했습니다.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
  }, [slug]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto' }}>
      <Title level={3}>🕓 버전 목록 - {slug}</Title>
      <List
        bordered
        dataSource={versions}
        renderItem={(item) => (
          <List.Item>
            <Link to={`/wiki/view/${slug}/version/${item.id}`}>
              버전 {item.id} - {new Date(item.edited_at).toLocaleString()} - {item.nickname_username || '익명'}
            </Link>
          </List.Item>
        )}
      />
      <Space style={{ marginTop: '1rem' }}>
        <Button onClick={() => prevUrl && fetchPage(prevUrl)} disabled={!prevUrl}>이전</Button>
        <Button onClick={() => nextUrl && fetchPage(nextUrl)} disabled={!nextUrl}>다음</Button>
        <Link to={`/wiki/view/${slug}`} style={{ marginLeft: 12 }}>← 최신 문서로</Link>
      </Space>
    </div>
  );
};

export default WikiVersionList;
