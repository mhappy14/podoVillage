import React, { useState, useEffect } from 'react';
import { AutoComplete, Input, Button, Flex, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const renderItem = (title, count) => ({
  value: title,
  label: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {title}
      <span>
        <UserOutlined /> {count}
      </span>
    </div>
  ),
});

const PaperWriteAuthor = ({ onRefresh }) => {
  const [authorList, setAuthorList] = useState([]);
  const [newAuthor, setNewAuthor] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAuthors = async () => {
    try {
      const response = await AxiosInstance.get('author/');
      setAuthorList(response.data);
    } catch (error) {
      console.error('Author 데이터 가져오기 오류:', error);
    }
  };

  const handleAddAuthor = async () => {
    setErrorMessage('');

    if (!newAuthor) {
      setErrorMessage('저자 값을 입력해주세요.');
      return;
    }

    try {
      await AxiosInstance.post('author/', { author: newAuthor });
      setNewAuthor('');
      onRefresh();
    } catch (error) {
      console.error('Author 추가 오류:', error);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  return (
    <Flex vertical>
      <Text level={5}>저자 추가</Text>
      <Flex vertical gap="small" style={{ width: '100%' }}>
        <AutoComplete
          popupMatchSelectWidth={500}
          style={{ width: '100%', marginTop: '0.5rem' }}
          value={newAuthor}
          onChange={(value) => setNewAuthor(value)}
          placeholder="저자"
        >
        </AutoComplete>
        <Button 
          type="primary" style={{ width: '100%'}} 
          onClick={handleAddAuthor} >
          추가
        </Button>
      </Flex>
      {errorMessage && (
        <Typography color="error" style={{ marginTop: '0.5rem' }}>
          {errorMessage}
        </Typography>
      )}
    </Flex>
  );
};

export default PaperWriteAuthor;
