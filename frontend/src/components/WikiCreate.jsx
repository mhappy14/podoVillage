// components/WikiCreate.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import WikiForm from './WikiForm';
import { Typography, message } from 'antd';

const WikiCreate = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (values) => {
    setSubmitting(true);
    AxiosInstance.post('/wiki/', values)
      .then((res) => {
        message.success('문서가 생성되었습니다.');
        navigate(`/wiki/view/${encodeURIComponent(res.data.title)}`);
      })
      .catch(() => message.error('생성에 실패했습니다.'))
      .finally(() => setSubmitting(false));
  };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: '2rem' }}>새 문서 작성</Typography.Title>
      <WikiForm onFinish={handleSubmit} loading={submitting} />
    </>
  );
};

export default WikiCreate;
