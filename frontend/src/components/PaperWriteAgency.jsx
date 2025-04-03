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

const PaperWriteAgency = ({ onRefresh }) => {
  const [agencyList, setAgencyList] = useState([]);
  const [newAgency, setNewAgency] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAgencies = async () => {
    try {
      const response = await AxiosInstance.get('agency/');
      setAgencyList(response.data);
    } catch (error) {
      console.error('Agency 데이터 가져오기 오류:', error);
    }
  };

  const handleAddAgency = async () => {
    setErrorMessage('');

    if (!newAgency) {
      setErrorMessage('기관 이름을 입력해주세요.');
      return;
    }

    try {
      await AxiosInstance.post('agency/', { agency: newAgency });
      setNewAgency('');
      onRefresh();
    } catch (error) {
      console.error('Agency 추가 오류:', error);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, []);

  return (
    <Flex vertical>
      <Text level={5}>발행기관 추가</Text>
      <Flex vertical gap="small" style={{ width: '100%' }}>
        <AutoComplete
          popupMatchSelectWidth={500}
          style={{ width: '100%', marginTop: '0.5rem' }}
          value={newAgency}
          onChange={(value) => setNewAgency(value)}
          placeholder="기관 이름"
        >
        </AutoComplete>
        <Button 
          type="primary" style={{ width: '100%' }} 
          onClick={handleAddAgency} >
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

export default PaperWriteAgency;