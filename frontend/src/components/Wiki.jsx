// components/Wiki.jsx
import React, { useEffect, useState } from 'react';
import { List, Typography, Button, Space, Spin, Alert } from 'antd';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

const Wiki = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    AxiosInstance.get('/wiki/')
      .then((res) => setPages(res.data))
      .catch(() => setError('문서 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

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
            <Typography.Text type="secondary" style={{ marginLeft: '1rem' }}>
              ({item.nickname_username || '익명'})
            </Typography.Text>
          </List.Item>
        )}
        style={{ marginTop: '1rem' }}
      />
    </div>
  );
};

export default Wiki;
