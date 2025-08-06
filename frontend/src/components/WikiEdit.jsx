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
    AxiosInstance.get(`/wiki/?slug=${slug}`)
      .then((res) => {
        if (res.data.length > 0) {
          setPage(res.data[0]);
        } else {
          setError('문서를 찾을 수 없습니다.');
        }
      })
      .catch(() => setError('문서를 불러오는 데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = (values) => {
    setSubmitting(true);
    AxiosInstance.put(`/wiki/${page.id}/`, values)
      .then(() => {
        message.success('문서가 수정되었습니다.');
        navigate(`/wiki/view/${page.slug}`);
      })
      .catch(() => message.error('수정에 실패했습니다.'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <Spin size="large" style={{ marginTop: '2rem' }} />;
  if (error) return <Alert message={error} type="error" showIcon style={{ marginTop: '2rem' }} />;

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>문서 수정</Typography.Title>
      <WikiForm initialValues={page} onFinish={handleSubmit} loading={submitting} />
    </>
  );
};

export default WikiEdit;
