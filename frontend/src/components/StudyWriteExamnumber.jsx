import React, { useState } from 'react';
import { Box, Button, TextField, FormControl, Select, InputLabel, MenuItem, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import AxiosInstance from './AxiosInstance';

const StudyWriteExamnumber = ({ examList, onExamNumberAdd }) => {
  const currentYear = new Date().getFullYear();
  const [selectedExam, setSelectedExam] = useState('');
  const [examNumber, setExamNumber] = useState('');
  const [date, setDate] = useState(dayjs(`${currentYear}-01`));
  const [examNumberMessage, setExamNumberMessage] = useState('');
  const [examNumberError, setExamNumberError] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false); // 중복 여부 상태

  const handleExamNumberChange = async (value) => {
    setExamNumber(value);

    if (!selectedExam || !value) {
      setIsDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('examnumber/check_examnumber/', {
        params: { exam: selectedExam, examnumber: value },
      });
      setIsDuplicate(response.data.exists);
    } catch (err) {
      console.error('Error checking examnumber:', err);
    }
  };

  const handleExamNumberSubmit = async (e) => {
    e.preventDefault();
    setExamNumberMessage('');
    setExamNumberError('');

    const year = date.year();

    if (!selectedExam || !examNumber || !year) {
      setExamNumberError('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('examnumber/', {
        exam: selectedExam,
        examnumber: examNumber,
        year: year,
      });
      setExamNumberMessage('시험회차가 성공적으로 등록되었습니다.');
      onExamNumberAdd(response.data);
      setSelectedExam('');
      setExamNumber('');
      setDate(dayjs(`${year}-01`));
    } catch (err) {
      setExamNumberError(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h6">Exam Number</Typography>
      <form onSubmit={handleExamNumberSubmit}>
        <FormControl fullWidth margin="normal">
          <InputLabel>시험명</InputLabel>
          <Select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
            {examList.map((exam) => (
              <MenuItem key={exam.id} value={exam.id}>
                {exam.examname}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label={selectedExam ? "시험 회차 번호(자연수만 입력 가능)" : "시험명을 먼저 선택해주세요."}
          variant="outlined"
          value={examNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[1-9]\d*$/.test(value) || value === '') {
              handleExamNumberChange(value);
            }
          }}
          fullWidth
          margin="normal"
          disabled={!selectedExam}
        />
        {isDuplicate && (
          <Typography color="red" variant="body2">
            이미 입력된 시험회차입니다.
          </Typography>
        )}
        <FormControl fullWidth margin="normal" sx={{ margin: '1rem 0 1rem 0' }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              views={['year']}
              label={examNumber ? "시행 연도" : "시험 회차 번호를 먼저 입력해주세요."}
              value={date}
              disabled={!examNumber || isDuplicate}
              onChange={(newValue) => setDate(newValue)}
              renderInput={(params) => (
                <TextField {...params} fullWidth margin="normal" />
              )}
            />
          </LocalizationProvider>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isDuplicate || !examNumber}
        >
          등록
        </Button>
        {examNumberMessage && <Typography color="green">{examNumberMessage}</Typography>}
        {examNumberError && <Typography color="red">{examNumberError}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteExamnumber;
