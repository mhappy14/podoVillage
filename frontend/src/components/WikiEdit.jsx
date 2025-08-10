import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import { Typography, Spin, Alert, message } from 'antd';

const WikiEdit = () => {
  const { '*': titlePath } = useParams();
  const title = decodeURIComponent(titlePath || '').trim();

  const [page, setPage] = useState(null);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const fetchPage = async () => {
      try {
        const res = await AxiosInstance.get(`/wiki/by-title/${encodeURIComponent(title)}/`);
        if (!alive) return;
        setPage(res.data);
        setSlug(res.data.slug);
      } catch (e) {
        if (!alive) return;
        setError('문서를 불러오는 데 실패했거나 존재하지 않습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPage();
    return () => { alive = false; };
  }, [title]);

  const handleSubmit = async (values) => {
    if (!slug) return;
    setSubmitting(true);
    try {
      await AxiosInstance.patch(`/wiki/${slug}/`, values);
      setTimeout(() => navigate(`/wiki/view/${encodeURIComponent(values.title)}`, { state: { justSaved: true } }), 100);
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

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;
  if (!page) return null;

  const initialValues = { title: page.title, content: page.content };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>문서 수정</Typography.Title>
      <WikiForm initialValues={initialValues} onFinish={handleSubmit} loading={submitting} />
    </>
  );
};

export default WikiEdit;
