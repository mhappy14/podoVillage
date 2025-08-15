import React, { useState, useEffect } from 'react';
import { AutoComplete, Button, Flex, Typography } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const PaperWriteAgency = ({ onRefresh }) => {
  const [agencyList, setAgencyList] = useState([]);
  const [newAgency, setNewAgency] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const toList = (raw) => (Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []));

  const fetchAgencies = async () => {
    try {
      const response = await AxiosInstance.get('agency/');
      setAgencyList(toList(response.data));
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
      onRefresh && onRefresh();
      fetchAgencies();
    } catch (error) {
      console.error('Agency 추가 오류:', error);
      setErrorMessage('기관 추가 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, []);

  const options = agencyList.map((a) => ({ value: a?.agency, label: a?.agency }));

  return (
    <Flex vertical>
      <Text strong>발행기관 추가</Text>
      <Flex vertical gap="small" style={{ width: '100%' }}>
        <AutoComplete
          options={options}
          popupMatchSelectWidth={500}
          style={{ width: '100%', marginTop: '0.5rem' }}
          value={newAgency}
          onChange={(value) => setNewAgency(value)}
          placeholder="기관 이름"
        />
        <Button type="primary" style={{ width: '100%' }} onClick={handleAddAgency}>
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

export default PaperWriteAgency;
