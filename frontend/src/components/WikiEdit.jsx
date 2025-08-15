// src/WikiEdit.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import { Typography, Spin, Alert, message } from 'antd';

const WikiEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 경로에서 제목 추출: /wiki/<제목>/edit  또는 /wiki/edit/<제목> (구형 호환)
  const title = useMemo(() => {
    const p = location.pathname;
    let m = p.match(/^\/wiki\/(.+?)\/edit\/?$/);
    if (m) return decodeURIComponent(m[1]);
    m = p.match(/^\/wiki\/edit\/(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    return '';
  }, [location.pathname]);

  const [page, setPage] = useState(null);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem('Token');
  const allowedByState = location.state?.allowEdit === true;

  // ✅ 가드: 로그인 + 버튼을 통한 진입만 허용
  useEffect(() => {
    if (!isLoggedIn || !allowedByState) {
      if (!isLoggedIn) {
        message.warning('로그인이 필요합니다.');
      } else {
        message.warning('편집 페이지는 문서 화면의 "수정" 버튼을 통해서만 열 수 있습니다.');
      }
      if (title) {
        navigate(`/wiki/v/${encodeURIComponent(title)}`, { replace: true });
      } else {
        navigate('/wiki', { replace: true });
      }
    }
  }, [isLoggedIn, allowedByState, title, navigate]);

  useEffect(() => {
    let alive = true;
    const fetchPage = async () => {
      if (!title || !isLoggedIn || !allowedByState) {
        setLoading(false);
        return;
      }
      try {
        const res = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(title)}/`);
        if (!alive) return;
        setPage(res.data);
        setSlug(res.data.slug);
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 404) {
          setPage({ title, content: '' });
          setSlug('');
          setError(null);
        } else {
          setError('문서를 불러오는 데 실패했습니다.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPage();
    return () => { alive = false; };
  }, [title, isLoggedIn, allowedByState]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (slug) {
        await AxiosInstance.patch(`/wiki/${slug}/`, values);
      } else {
        await AxiosInstance.post('/wiki/', values);
      }
      navigate(`/wiki/v/${encodeURIComponent(values.title)}`, { state: { justSaved: true } });
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

  if (!isLoggedIn || !allowedByState) return null; // 가드에 걸리면 즉시 리다이렉트되므로 렌더 막음
  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  const initialValues = page ? { title: page.title, content: page.content || '' } : { title, content: '' };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>
        {slug ? '문서 수정' : '새 문서 작성'}
      </Typography.Title>
      <WikiForm initialValues={initialValues} onFinish={handleSubmit} loading={submitting} />
    </>
  );
};

export default WikiEdit;
