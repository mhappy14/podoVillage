import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const EssayWriteProducer = ({ onRefresh }) => {
  const [producerList, setProducerList] = useState([]);
  const [newProducer, setNewProducer] = useState({ job: '', producer_name: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const fetchProducers = async () => {
    try {
      const response = await AxiosInstance.get('producer/');
      setProducerList(response.data);
    } catch (error) {
      console.error('Producer 데이터 가져오기 오류:', error);
    }
  };

  const handleAddProducer = async () => {
    setErrorMessage('');

    if (!newProducer.job && !newProducer.producer_name) {
      setErrorMessage('구분과 이름 값을 입력해주세요.');
      return;
    }

    if (!newProducer.job) {
      setErrorMessage('구분 값을 입력해주세요.');
      return;
    }

    if (!newProducer.producer_name) {
      setErrorMessage('이름 값을 입력해주세요.');
      return;
    }

    try {
      await AxiosInstance.post('producer/', newProducer);
      setNewProducer({ job: '', producer_name: '' });
      onRefresh();
    } catch (error) {
      console.error('Producer 추가 오류:', error);
    }
  };

  useEffect(() => {
    fetchProducers();
  }, []);

  return (
    <Box>
      <Typography variant="h6">제작자 추가</Typography>
      <FormControl fullWidth margin="normal">
        <InputLabel id="job-select-label">구분</InputLabel>
        <Select
          labelId="job-select-label"
          value={newProducer.job}
          onChange={(e) => setNewProducer({ ...newProducer, job: e.target.value })}
        >
          <MenuItem value="author">Author</MenuItem>
          <MenuItem value="translator">Translator</MenuItem>
        </Select>
      </FormControl>
      <TextField
        label="이름"
        value={newProducer.producer_name}
        onChange={(e) => setNewProducer({ ...newProducer, producer_name: e.target.value })}
        fullWidth
        margin="normal"
        disabled={!newProducer.job} // 구분을 선택하지 않으면 비활성화
      />
      <Button variant="contained" fullWidth onClick={handleAddProducer} sx={{ marginTop: '1rem' }}>
        추가
      </Button>
      {errorMessage && (
        <Typography color="error" sx={{ marginTop: '1rem' }}>
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
};

export default EssayWriteProducer;
