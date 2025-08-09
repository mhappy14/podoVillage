// components/WikiEdit.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import { Typography, Spin, Alert, message } from 'antd';

const WikiEdit = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const fetchPage = async () => {
      setLoading(true);
      try {
        const res = await AxiosInstance.get(`/wiki/${slug}/`);
        if (!alive) return;
        setPage(res.data);
      } catch (e) {
        if (!alive) return;
        setError('문서를 불러오는 데 실패했거나 존재하지 않습니다.');
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPage();
    return () => { alive = false; };
  }, [slug]);

  const handleSubmit = async (values) => {
    // values는 보통 { title, content } 형태여야 합니다.
    setSubmitting(true);
    try {
      await AxiosInstance.patch(`/wiki/${slug}/`, values);
      setTimeout(() => navigate(`/wiki/view/${slug}`, { state: { justSaved: true } }), 100);
    } catch (e) {
      // 403 (로그인 필요), 400 (유효성), 기타 서버 오류 메시지 노출
      const detail =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        '수정에 실패했습니다.';
      message.error(detail);
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;
  if (!page) return null;

  // WikiForm에 꼭 필요한 초기값만 넘기세요.
  const initialValues = { title: page.title, content: page.content };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>문서 수정</Typography.Title>
      <WikiForm initialValues={initialValues} onFinish={handleSubmit} loading={submitting} />
    </>
  );
};

export default WikiEdit;
