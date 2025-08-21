// src/WikiForm.jsx
import React from 'react';
import { Form, Input, Button } from 'antd';

const WikiForm = ({ initialValues, onFinish, loading, onValuesChange, hideTitle = false }) => {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
      onValuesChange={onValuesChange}
    >
      {!hideTitle && (
        <Form.Item
          name="title"
          label="제목"
          rules={[{ required: true, message: '제목을 입력하세요' }]}
        >
          <Input />
        </Form.Item>
      )}

      <Form.Item
        name="content"
        label="내용"
        rules={[{ required: true, message: '내용을 입력하세요' }]}
      >
        <Input.TextArea rows={16} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          저장
        </Button>
      </Form.Item>
    </Form>
  );
};

export default WikiForm;
