import React, { useState, useEffect } from 'react';
import { AutoComplete, Button, Flex, Typography } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const PaperWriteAuthor = ({ onRefresh }) => {
  const [authorList, setAuthorList] = useState([]);
  const [newAuthor, setNewAuthor] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const toList = (raw) => (Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []));

  const fetchAuthors = async () => {
    try {
      const response = await AxiosInstance.get('author/');
      setAuthorList(toList(response.data));
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
      onRefresh && onRefresh();
      fetchAuthors();
    } catch (error) {
      console.error('Author 추가 오류:', error);
      setErrorMessage('저자 추가 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const options = authorList.map((a) => ({ value: a?.author, label: a?.author }));

  return (
    <Flex vertical>
      <Text strong>저자 추가</Text>
      <Flex vertical gap="small" style={{ width: '100%' }}>
        <AutoComplete
          options={options}
          popupMatchSelectWidth={500}
          style={{ width: '100%', marginTop: '0.5rem' }}
          value={newAuthor}
          onChange={(value) => setNewAuthor(value)}
          placeholder="저자"
        />
        <Button type="primary" style={{ width: '100%'}} onClick={handleAddAuthor}>
          추가
        </Button>
      </Flex>
      {errorMessage && (
        <Text type="danger" style={{ marginTop: '0.5rem' }}>
          {errorMessage}
        </Text>
      )}
    </Flex>
  );
};

export default PaperWriteAuthor;
