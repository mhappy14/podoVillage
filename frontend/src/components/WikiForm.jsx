// components/WikiForm.jsx
import React from 'react';
import { Form, Input, Button } from 'antd';

const { TextArea } = Input;

const WikiForm = ({ initialValues = {}, onFinish, loading }) => {
  const [form] = Form.useForm();

  // 초기값이 주어지면 form에 설정
  React.useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      style={{ maxWidth: 800, margin: '2rem auto' }}
    >
      <Form.Item
        label="제목"
        name="title"
        rules={[{ required: true, message: '제목을 입력하세요.' }]}
      >
        <Input placeholder="문서 제목을 입력하세요" />
      </Form.Item>

      <Form.Item
        label="내용"
        name="content"
        rules={[{ required: true, message: '내용을 입력하세요.' }]}
      >
        <TextArea
          placeholder="문서 내용을 입력하세요"
          autoSize={{ minRows: 10 }}
        />
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
