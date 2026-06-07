// src/WikiEdit.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Typography, Tabs, Space, Spin, Alert, message } from 'antd';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import WikiGuide from './WikiGuide';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

export default function WikiEdit() {
  const location = useLocation();
  const navigate = useNavigate();

  // /wiki/v/<제목>/edit
  const title = useMemo(() => {
    const p = location.pathname;
    const m = p.match(/^\/wiki\/v\/(.+?)\/edit\/?$/);
    return m ? decodeURIComponent(m[1]).replace(/\/+$/, '') : '';
  }, [location.pathname]);

  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem('Token');
  const allowedByState = location.state?.allowEdit === true;

  useEffect(() => {
    if (!isLoggedIn || !allowedByState || !title) {
      if (!isLoggedIn) message.warning('로그인이 필요합니다.');
      else if (!allowedByState) message.warning('문서 화면의 "수정" 버튼으로만 접근할 수 있습니다.');
      else message.warning('잘못된 문서 경로입니다.');
      navigate(title ? `/wiki/v/${encodeURIComponent(title)}` : '/wiki', { replace: true });
    }
  }, [isLoggedIn, allowedByState, title, navigate]);

  // 기존 문서 로드 (없으면 생성 페이지로 안내)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!title || !isLoggedIn || !allowedByState) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // 백엔드가 by-title 경로 파라미터 버전일 때
        const res = await AxiosInstance.get(`wiki/by-title/${encodeURIComponent(title)}/`);
        if (!alive) return;
        setSlug(res.data.slug);
        setContent(res.data.content || '');
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 404) {
          message.info('작성된 문서가 없어 새로 작성 페이지로 이동합니다.');
          navigate(`/wiki/v/${encodeURIComponent(title)}/create`, {
            replace: true,
            state: { allowEdit: true },
          });
          return;
        } else {
          const msg =
            e?.response?.data?.detail ||
            (typeof e?.response?.data === 'string' ? e.response.data : '') ||
            '문서를 불러오는 데 실패했습니다.';
          setError(msg);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [title, isLoggedIn, allowedByState, navigate]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await AxiosInstance.patch(`wiki/${slug}/`, values);
      navigate(`/wiki/v/${encodeURIComponent(title)}`, { state: { justSaved: true } });
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        '수정에 실패했습니다.';
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(content || '');
    return DOMPurify.sanitize(raw);
  }, [content]);

  if (!isLoggedIn || !allowedByState) return null;
  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>
        문서 수정: {title}
      </Typography.Title>

      <Tabs
        defaultActiveKey="edit"
        items={[
          {
            key: 'edit',
            label: '편집',
            children: (
              <WikiForm
                initialValues={{ content }}
                onFinish={handleSubmit}
                loading={submitting}
                onValuesChange={(_, values) => {
                  if (Object.prototype.hasOwnProperty.call(values, 'content')) {
                    setContent(values.content ?? '');
                  }
                }}
                hideTitle
              />
            ),
          },
          {
            key: 'preview',
            label: '미리보기',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="wiki-body wiki-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </Space>
            ),
          },
          {
            key: 'guide',
            label: '문법 도움말',
            children: <WikiGuide />,
          },
        ]}
      />
    </>
  );
}
