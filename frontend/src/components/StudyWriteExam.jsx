import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const StudyWriteExam  = ({ examList, onExamAdd }) => {
  const [examName, setExamName] = useState('');
  const [examMessage, setExamMessage] = useState('');
  const [examError, setExamError] = useState('');

  const handleExamSubmit = async (e) => {
    e.preventDefault();
    setExamMessage('');
    setExamError('');

    if (!examName.trim()) {
      setExamError('시험명을 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('exam/', {
        examname: examName,
      });
      onExamAdd(response.data);
      setExamMessage('시험명이 성공적으로 등록되었습니다.');
      setExamName('');
      window.location.reload();
    } catch (err) {
      setExamError(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <Box sx={{ margin: '0 0 0 1rem'}}>
      <Typography variant="h6">Exam</Typography>
      <form onSubmit={handleExamSubmit}>
        <TextField
          label="시험명"
          variant="outlined"
          value={examName}
          onChange={(e) => setExamName(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button type="submit" variant="contained" color="primary" fullWidth>
          등록
        </Button>
        {examMessage && <Typography color="green">{examMessage}</Typography>}
        {examError && <Typography color="red">{examError}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteExam ;
