import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';
import { Card, Typography, Spin, Alert, Space, Button, Tag } from 'antd';

const { Title, Paragraph, Text } = Typography;

const WikiVersionView = () => {
  const { title, versionId } = useParams();
  const decodedTitle = decodeURIComponent(title || '').trim();

  const [version, setVersion] = useState(null);
  const [pageTitle, setPageTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        const pageRes = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(decodedTitle)}/`);
        if (!pageRes.data.slug) throw new Error();
        setSlug(pageRes.data.slug);
        setPageTitle(pageRes.data.title);

        const versionRes = await AxiosInstance.get(`/wiki/${pageRes.data.slug}/versions/`);
        const results = versionRes.data.results ?? versionRes.data;
        const found = results.find(v => String(v.id) === String(versionId));
        if (found) {
          setVersion(found);
        } else {
          setError('해당 버전을 찾을 수 없습니다.');
        }
      } catch {
        setError('버전을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [decodedTitle, versionId]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;
  if (!version) return null;

  const contentHtml = parseWikiSyntax(version.content);

  return (
    <Card
      title={<Title level={3}>{pageTitle} (v{version.id})</Title>}
      extra={
        <Space wrap>
          <Text type="secondary">작성자 : {version.nickname_username || '익명'}</Text>
          <Tag>{new Date(version.edited_at).toLocaleString()}</Tag>
          <Link to={`/wiki/view/${encodeURIComponent(decodedTitle)}/versions`}>
            <Button>버전 목록</Button>
          </Link>
          <Link to={`/wiki/view/${encodeURIComponent(decodedTitle)}`}>
            <Button type="primary">최신 문서</Button>
          </Link>
        </Space>
      }
      style={{ marginTop: '2rem' }}
    >
      <Paragraph>
        <div
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </Paragraph>
    </Card>
  );
};

export default WikiVersionView;
