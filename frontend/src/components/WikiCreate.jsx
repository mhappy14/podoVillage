// src/WikiCreate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Typography, Tabs, Space, Spin, Alert, message } from 'antd';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

const DRAFT_KEY = (title) => `wiki:draft:${encodeURIComponent(title)}`;

export default function WikiCreate() {
  const location = useLocation();
  const navigate = useNavigate();

  // /wiki/v/<제목>/create
  const title = useMemo(() => {
    const p = location.pathname;
    const m = p.match(/^\/wiki\/v\/(.+?)\/create\/?$/);
    return m ? decodeURIComponent(m[1]).replace(/\/+$/, '') : '';
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ content: '' });

  const isLoggedIn = !!localStorage.getItem('Token');
  const allowedByState = location.state?.allowEdit === true; // 뷰에서 버튼 통해서만 진입

  // 접근 가드
  useEffect(() => {
    if (!isLoggedIn || !allowedByState || !title) {
      if (!isLoggedIn) message.warning('로그인이 필요합니다.');
      else if (!allowedByState) message.warning('문서 화면의 "작성하기" 버튼으로만 접근할 수 있습니다.');
      else message.warning('잘못된 문서 경로입니다.');
      navigate(title ? `/wiki/v/${encodeURIComponent(title)}` : '/wiki', { replace: true });
    }
  }, [isLoggedIn, allowedByState, title, navigate]);

  // 로컬 임시 저장 불러오기
  useEffect(() => {
    const local = localStorage.getItem(DRAFT_KEY(title));
    const initialContent = local ? JSON.parse(local)?.content || '' : '';
    setDraft({ content: initialContent });
    setLoading(false);
  }, [title]);

  // 저장(생성)
  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await AxiosInstance.post('wiki/', { ...values, title });
      localStorage.removeItem(DRAFT_KEY(title));
      navigate(`/wiki/v/${encodeURIComponent(title)}`, { state: { justSaved: true } });
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        '생성에 실패했습니다.';
      setError(detail);
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // 편집 중 임시 저장 (디바운스)
  const savingRef = useRef(false);
  const handleValuesChange = (_, values) => {
    if (Object.prototype.hasOwnProperty.call(values, 'content')) {
      const content = values.content ?? '';
      setDraft((prev) => ({ ...prev, content }));
      if (savingRef.current) return;
      savingRef.current = true;
      setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY(title), JSON.stringify({ content }));
        } catch {}
        savingRef.current = false;
      }, 800);
    }
  };

  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(draft.content || '');
    return DOMPurify.sanitize(raw);
  }, [draft.content]);

  if (!isLoggedIn || !allowedByState) return null;
  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  const initialValues = { content: draft.content || '' };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>
        새 문서 작성: {title}
      </Typography.Title>

      <Tabs
        defaultActiveKey="edit"
        items={[
          {
            key: 'edit',
            label: '편집',
            children: (
              <WikiForm
                initialValues={initialValues}
                onFinish={handleSubmit}
                loading={submitting}
                onValuesChange={handleValuesChange}
                hideTitle
              />
            ),
          },
          {
            key: 'preview',
            label: '미리보기',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="wiki-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </Space>
            ),
          },
        ]}
      />
    </>
  );
}
