import React, { useState } from 'react';
import { Box, Button, TextField, FormControl, Select, InputLabel, MenuItem, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const StudyWriteDetailsubject = ({ examList, mainsubjectList, onDetailsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedMainsubject, setSelectedMainsubject] = useState('');
  const [detailnumber, setDetailnumber] = useState('');
  const [detailtitle, setDetailtitle] = useState('');
  const [detailSubjectMessage, setDetailSubjectMessage] = useState('');
  const [detailSubjectError, setDetailSubjectError] = useState('');
  const [isDetailnumberDuplicate, setIsDetailnumberDuplicate] = useState(false);
  const [filteredMainsubjects, setFilteredMainsubjects] = useState(mainsubjectList);

  const handleDetailnumberChange = async (value) => {
    setDetailnumber(value);

    if (!selectedMainsubject || !value) {
      setIsDetailnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get(`detailsubject/check_detailnumber/`, {
        params: { mainslug: selectedMainsubject, detailnumber: value },
      });

      setIsDetailnumberDuplicate(response.data.exists);
    } catch (error) {
      console.error('Error checking detailnumber:', error);
    }
  };

  const handleDetailSubjectSubmit = async (e) => {
    e.preventDefault();
    setDetailSubjectMessage('');
    setDetailSubjectError('');

    if (!selectedExam || !selectedMainsubject || !detailnumber || !detailtitle) {
      setDetailSubjectError('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('detailsubject/', {
        exam: selectedExam,
        mainslug: selectedMainsubject,
        detailnumber: detailnumber,
        detailtitle: detailtitle,
      });
      onDetailsubjectAdd(response.data);
      setDetailSubjectMessage('세부과목이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setSelectedMainsubject('');
      setDetailnumber('');
      setDetailtitle('');
    } catch (err) {
      setDetailSubjectError(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleExamChange = (e) => {
    const selectedExamId = e.target.value;
    setSelectedExam(selectedExamId);
    setSelectedMainsubject('');
    setFilteredMainsubjects(
      mainsubjectList.filter((mainSubject) => mainSubject.exam?.id === parseInt(selectedExamId))
    );
  };

  // 공통 정렬 함수
  const sortByKey = (array, key, referenceArray = null, ascending = true) => {
    return array.slice().sort((a, b) => {
      const valueA = referenceArray
        ? referenceArray.find((item) => item.id === a)?.[key]
        : a[key];
      const valueB = referenceArray
        ? referenceArray.find((item) => item.id === b)?.[key]
        : b[key];
  
      if (!valueA || !valueB) return 0; // 값이 없을 경우
  
      const comparison = valueA.localeCompare(valueB); // 기본 비교 (오름차순)
  
      return ascending ? comparison : -comparison; // ascending에 따라 방향 결정
    });
  };

  return (
    <Box sx={{ margin: '0 1rem 0 0' }}>
      <Typography variant="h6">세부과목 등록</Typography>
      <form onSubmit={handleDetailSubjectSubmit}>
        <FormControl fullWidth margin="normal">
          <InputLabel>시험명</InputLabel>
          <Select value={selectedExam} onChange={handleExamChange}>
            {sortByKey(examList, 'examname').map((exam) => (
              <MenuItem key={exam.id} value={exam.id}>
                {exam.examname}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal" disabled={!selectedExam}>
          <InputLabel>{selectedExam ? '주요과목' : '주요과목(시험명을 먼저 선택해주세요).'}</InputLabel>
          <Select value={selectedMainsubject} onChange={(e) => setSelectedMainsubject(e.target.value)}>
            {sortByKey(filteredMainsubjects, 'mainslug').map((mainSubject) => (
              <MenuItem key={mainSubject.id} value={mainSubject.id}>
                {mainSubject.mainslug}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label={selectedMainsubject ? '세부과목번호(자연수만 입력 가능)' : '세부과목번호(주요과목을 먼저 선택해주세요).'}
          variant="outlined"
          value={detailnumber}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[1-9]\d*$/.test(value) || value === '') {
              handleDetailnumberChange(value);
            }
          }}
          fullWidth
          margin="normal"
          disabled={!selectedMainsubject}
        />
        {isDetailnumberDuplicate && (
          <Typography color="red" variant="body2">
            이미 등록된 세부과목입니다.
          </Typography>
        )}
        <TextField
          label={selectedMainsubject ? '세부과목(이미 등록된 경우, 입력 불가)' : '세부과목(주요과목을 먼저 선택해주세요).'}
          variant="outlined"
          value={detailtitle}
          onChange={(e) => setDetailtitle(e.target.value)}
          fullWidth
          margin="normal"
          disabled={!selectedMainsubject || isDetailnumberDuplicate}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isDetailnumberDuplicate || !detailtitle}
        >
          등록
        </Button>
        {detailSubjectMessage && <Typography color="green">{detailSubjectMessage}</Typography>}
        {detailSubjectError && <Typography color="red">{detailSubjectError}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteDetailsubject;
