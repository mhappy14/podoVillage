// src/WikiVersionView.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Space, Tag, Button } from 'antd';
import AxiosInstance from './AxiosInstance';
import parseWikiSyntax from './WikiParser';

const { Title, Paragraph } = Typography;

// /wiki/v/:title/versionslist/:id 에서 동작
export default function WikiVersionView() {
  const { title: titleParam, id: idParam } = useParams();
  const navigate = useNavigate();

  const title = decodeURIComponent(titleParam || '').trim();
  const versionId = String(idParam || '').trim();

  const [slug, setSlug] = useState('');
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 페이지네이션 next를 '?page=N' 으로 정규화
  const normalizePageQuery = (nextUrl) => {
    if (!nextUrl) return null;
    try {
      const u = new URL(nextUrl);
      const p = u.searchParams.get('page');
      return p ? `?page=${p}` : null;
    } catch {
      // 이미 상대경로 형태일 수도 있음
      return nextUrl;
    }
  };

  useEffect(() => {
    let alive = true;

    const fetchSlug = async () => {
      setLoading(true);
      setError(null);
      setVersion(null);
      setSlug('');

      if (!title) {
        setError('잘못된 경로입니다. 문서 제목이 비었습니다.');
        setLoading(false);
        return;
      }

      try {
        const pageRes = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(title)}/`);
        if (!alive) return;
        if (!pageRes?.data?.slug) throw new Error('문서를 찾을 수 없습니다.');
        setSlug(pageRes.data.slug);
      } catch (e) {
        if (!alive) return;
        setError('문서를 찾을 수 없습니다.');
        setLoading(false);
      }
    };

    fetchSlug();
    return () => { alive = false; };
  }, [title]);

  useEffect(() => {
    if (!slug || !versionId) return;

    let alive = true;

    const fetchVersion = async () => {
      setLoading(true);
      setError(null);
      setVersion(null);

      // 1) /wikiversions/:id/ 시도
      try {
        const res1 = await AxiosInstance.get(`/wikiversions/${versionId}/`);
        if (!alive) return;
        if (res1?.data?.id) {
          setVersion(res1.data);
          setLoading(false);
          return;
        }
      } catch (_) {
        // 계속 진행
      }

      // 2) /wiki/:slug/versions/:id/ 시도
      try {
        const res2 = await AxiosInstance.get(`/wiki/${slug}/versions/${versionId}/`);
        if (!alive) return;
        if (res2?.data?.id) {
          setVersion(res2.data);
          setLoading(false);
          return;
        }
      } catch (_) {
        // 계속 진행
      }

      // 3) 페이지네이션으로 탐색
      try {
        let pageQuery = '';
        while (true) {
          const res = await AxiosInstance.get(`/wiki/${slug}/versions/${pageQuery}`);
          if (!alive) return;

          const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          const found = list.find(v => String(v.id) === String(versionId));
          if (found) {
            setVersion(found);
            setLoading(false);
            return;
          }

          const nextQ = normalizePageQuery(res.data?.next);
          if (!nextQ) break; // 더 없음
          pageQuery = nextQ;
        }

        // 못 찾음
        setError('해당 버전을 찾지 못했습니다.');
      } catch (e) {
        if (!alive) return;
        setError('버전 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchVersion();
    return () => { alive = false; };
  }, [slug, versionId]);

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;

  if (error) {
    return (
      <Alert
        message="버전 정보를 표시할 수 없습니다."
        description={
          <div>
            <div style={{ marginBottom: 8 }}>{error}</div>
            <div><b>요청한 문서:</b> {title}</div>
            <div><b>버전 ID:</b> {versionId}</div>
          </div>
        }
        type="error"
        showIcon
        style={{ marginTop: '2rem' }}
      />
    );
  }

  const contentHtml = parseWikiSyntax(version?.content || '');
  const editedAt = version?.edited_at ? new Date(version.edited_at).toLocaleString() : '';
  const editor = version?.nickname_username || version?.nickname?.username || '익명';

  return (
    <Card
      title={<Title level={3}>{title} — 버전 v{version?.id}</Title>}
      extra={
        <Space wrap>
          <Tag color="default">{editedAt}</Tag>
          <Tag color="default">작성자: {editor}</Tag>
          <Button onClick={() => navigate(`/wiki/v/${encodeURIComponent(title)}/versionslist`)}>목록으로</Button>
          <Button type="primary" onClick={() => navigate(`/wiki/v/${encodeURIComponent(title)}`)}>
            최신 문서로
          </Button>
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
}
