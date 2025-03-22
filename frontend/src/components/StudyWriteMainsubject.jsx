import React, { useState } from 'react';
import { Box, Button, TextField, FormControl, Select, InputLabel, MenuItem, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const StudyWriteMainsubject = ({ examList, onMainsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [mainnumber, setMainnumber] = useState('');
  const [mainname, setMainname] = useState('');
  const [mainSubjectMessage, setMainSubjectMessage] = useState('');
  const [mainSubjectError, setMainSubjectError] = useState('');
  const [isMainnumberDuplicate, setIsMainnumberDuplicate] = useState(false); // 중복 여부 상태

  const handleMainnumberChange = async (value) => {
    setMainnumber(value);

    if (!selectedExam || !value) {
      setIsMainnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get(`mainsubject/check_mainnumber/`, {
        params: { exam: selectedExam, mainnumber: value },
      });

      setIsMainnumberDuplicate(response.data.exists); // 중복 여부 설정
    } catch (error) {
      console.error('Error checking mainnumber:', error);
    }
  };

  const handleMainSubjectSubmit = async (e) => {
    e.preventDefault();
    setMainSubjectMessage('');
    setMainSubjectError('');

    if (!selectedExam || !mainnumber || !mainname) {
      setMainSubjectError('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('mainsubject/', {
        exam: selectedExam,
        mainnumber: mainnumber,
        mainname: mainname,
      });
      onMainsubjectAdd(response.data);
      setMainSubjectMessage('주요과목이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setMainnumber('');
      setMainname('');
    } catch (err) {
      setMainSubjectError(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <Box sx={{ margin: '0 0 0 1rem' }}>
      <Typography variant="h6">주요과목 등록</Typography>
      <form onSubmit={handleMainSubjectSubmit}>
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
          label={selectedExam ? "주요과목번호(자연수만 입력 가능)" : "주요과목번호(시험명을 먼저 선택해주세요)."}
          variant="outlined"
          value={mainnumber}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[1-9]\d*$/.test(value) || value === '') {
              handleMainnumberChange(value);
            }
          }}
          fullWidth
          margin="normal"
          disabled={!selectedExam}
        />
        {isMainnumberDuplicate && (
          <Typography color="red" variant="body2">
            이미 등록된 주요과목입니다.
          </Typography>
        )}
        <TextField
          label={mainnumber && !isMainnumberDuplicate ? "주요과목(이미 등록된 경우, 입력 불가)" : "주요과목(주요과목번호를 먼저 선택해주세요)."}
          variant="outlined"
          value={mainname}
          onChange={(e) => setMainname(e.target.value)}
          fullWidth
          margin="normal"
          disabled={!mainnumber || isMainnumberDuplicate}
        />
        <Button type="submit" variant="contained" color="primary" fullWidth disabled={isMainnumberDuplicate}>
          등록
        </Button>
        {mainSubjectMessage && <Typography color="green">{mainSubjectMessage}</Typography>}
        {mainSubjectError && <Typography color="red">{mainSubjectError}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteMainsubject;
