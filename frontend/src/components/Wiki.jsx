import React, { useEffect, useState } from 'react';
import { List, Typography, Button, Space, Spin, Alert } from 'antd';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

const Wiki = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPages = (url = '/wiki/') => {
    setLoading(true);
    AxiosInstance.get(url)
      .then((res) => {
        setPages(res.data.results);
        setNextUrl(res.data.next);
        setPrevUrl(res.data.previous);
      })
      .catch(() => setError('문서 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleNext = () => {
    if (nextUrl) {
      fetchPages(nextUrl);
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (prevUrl) {
      fetchPages(prevUrl);
      setCurrentPage((prev) => prev - 1);
    }
  };

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Title level={2}>📚 위키 문서 목록</Title>
        <Link to="/wiki/create">
          <Button type="primary">새 문서 작성</Button>
        </Link>
      </Space>

      <List
        bordered
        dataSource={pages}
        renderItem={(item) => (
          <List.Item>
            <Link to={`/wiki/view/${item.slug}`}>{item.title}</Link>
          </List.Item>
        )}
        style={{ marginTop: '1rem' }}
      />

      <Space style={{ marginTop: '1rem' }}>
        <Button onClick={handlePrev} disabled={!prevUrl}>
          이전 페이지
        </Button>
        <Button onClick={handleNext} disabled={!nextUrl}>
          다음 페이지
        </Button>
        <span style={{ marginLeft: 10 }}>
          (현재 페이지: {currentPage})
        </span>
      </Space>
    </div>
  );
};

export default Wiki;
