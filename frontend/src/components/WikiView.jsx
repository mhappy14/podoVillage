// components/WikiView.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Button, Spin, Alert, Space } from 'antd';

const { Title, Paragraph } = Typography;

const WikiView = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    AxiosInstance.get(`/wiki/?slug=${slug}`)
      .then((res) => {
        if (res.data.length > 0) {
          setPage(res.data[0]);
        } else {
          setError('문서를 찾을 수 없습니다.');
        }
      })
      .catch((err) => {
        setError('문서를 불러오는 데 실패했습니다.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <Card
      title={<Title level={3}>{page.title}</Title>}
      extra={
        <Space>
          <Typography.Text type="secondary">
            {page.nickname_username || '익명'}
          </Typography.Text>
          <Link to={`/wiki/edit/${page.slug}`}>
            <Button type="primary">수정</Button>
          </Link>
        </Space>
      }
      style={{ marginTop: '2rem' }}
    >
      <Paragraph>
        <div
          dangerouslySetInnerHTML={{ __html: parseWikiSyntax(page.content) }}
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </Paragraph>
    </Card>
  );
};

export default WikiView;
