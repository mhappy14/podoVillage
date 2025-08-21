// src/WikiEdit.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import { Typography, Spin, Alert, message, Tabs, Space } from 'antd';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

const WikiEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 경로에서 제목 추출: /wiki/v/<제목>/edit
  const title = useMemo(() => {
    const p = location.pathname;
    const m = p.match(/^\/wiki\/v\/(.+?)\/edit\/?$/);
    return m ? decodeURIComponent(m[1]).replace(/\/+$/, '') : ''; // 끝 슬래시 제거
  }, [location.pathname]);

  const [page, setPage] = useState(null);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ content: '' });

  const isLoggedIn = !!localStorage.getItem('Token');
  const allowedByState = location.state?.allowEdit === true;
  const startBlank = location.state?.startBlank === true; // ← 추가

  // ✅ 가드
  useEffect(() => {
    if (!isLoggedIn || !allowedByState) {
      if (!isLoggedIn) {
        message.warning('로그인이 필요합니다.');
      } else {
        message.warning('편집 페이지는 문서 화면의 "수정" 버튼을 통해서만 열 수 있습니다.');
      }
      if (title) navigate(`/wiki/v/${encodeURIComponent(title)}`, { replace: true });
      else navigate('/wiki', { replace: true });
    }
  }, [isLoggedIn, allowedByState, title, navigate]);

  // 문서 로드 (startBlank면 서버 호출 생략)
  useEffect(() => {
    let alive = true;

    const bootstrapBlank = () => {
      setPage({ title, content: '' });
      setSlug('');
      setError(null);
      setDraft({ content: '' });
      setLoading(false);
    };

    const fetchPage = async () => {
      if (!title || !isLoggedIn || !allowedByState) {
        setLoading(false);
        return;
      }

      // ← 문서 없음 화면에서 넘어온 경우: 서버 호출 생략
      if (startBlank) {
        bootstrapBlank();
        return;
      }

      try {
        // 기존 엔드포인트 유지 (서버가 /wiki/by-title/<title>/ 형태일 때)
        const res = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(title)}/`);

        if (!alive) return;
        setPage(res.data);
        setSlug(res.data.slug);
        setDraft({ content: res.data.content || '' });
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 404) {
          // 문서 없음: 빈 편집으로
          bootstrapBlank();
        } else {
          setError('문서를 불러오는 데 실패했습니다.');
          setLoading(false);
        }
      }
    };

    fetchPage();
    return () => { alive = false; };
  }, [title, isLoggedIn, allowedByState, startBlank]);

  // 저장
  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (slug) {
        await AxiosInstance.patch(`/wiki/${slug}/`, values);
      } else {
        await AxiosInstance.post('/wiki/', { ...values, title }); // 제목 강제
      }
      navigate(`/wiki/v/${encodeURIComponent(title)}`, { state: { justSaved: true } });
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        (slug ? '수정에 실패했습니다.' : '생성에 실패했습니다.');
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // 미리보기
  const handleValuesChange = (_, values) => {
    if (Object.prototype.hasOwnProperty.call(values, 'content')) {
      setDraft(prev => ({ ...prev, content: values.content }));
    }
  };

  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(draft.content || '');
    return DOMPurify.sanitize(raw);
  }, [draft.content]);

  if (!isLoggedIn || !allowedByState) return null;
  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  const initialValues = page ? { content: page.content || '' } : { content: '' };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>
        {slug ? `문서 수정: ${title}` : `새 문서 작성: ${title}`}
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
                <div
                  className="wiki-preview"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </Space>
            ),
          },
        ]}
      />
    </>
  );
};

export default WikiEdit;
