import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const EssayWriteAgency = ({ onRefresh }) => {
  const [agencyList, setAgencyList] = useState([]);
  const [newAgency, setNewAgency] = useState('');

  const fetchAgencies = async () => {
    try {
      const response = await AxiosInstance.get('agency/');
      setAgencyList(response.data);
    } catch (error) {
      console.error('Agency 데이터 가져오기 오류:', error);
    }
  };

  const handleAddAgency = async () => {
    try {
      await AxiosInstance.post('agency/', { agency_name: newAgency });
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
    <Box>
      <Typography variant="h6">기관 추가</Typography>
      <TextField
        label="기관 이름"
        value={newAgency}
        onChange={(e) => setNewAgency(e.target.value)}
        fullWidth
        margin="normal"
      />
      <Button fullWidth variant="contained" onClick={handleAddAgency} sx={{ marginTop: '1rem' }}>
        추가
      </Button>
    </Box>
  );
};

export default EssayWriteAgency;
