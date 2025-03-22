import React, { useState } from 'react';
import { Box, Button, TextField, FormControl, Select, InputLabel, MenuItem, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const StudyWriteQuestion = ({ examList, examNumberList, onQuestionAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [questionNumber1, setQuestionNumber1] = useState('');
  const [questionNumber2, setQuestionNumber2] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false); // 중복 여부 상태
  const [filteredExamNumbers, setFilteredExamNumbers] = useState(examNumberList);

  const handleQuestionNumberChange = async (key, value) => {
    if (key === 'questionNumber1') setQuestionNumber1(value);
    if (key === 'questionNumber2') setQuestionNumber2(value);

    if (!selectedExam || !selectedExamNumber || !value) {
      setIsDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('question/check_question/', {
        params: {
          exam: selectedExam,
          examnumber: selectedExamNumber,
          questionnumber1: key === 'questionNumber1' ? value : questionNumber1,
          questionnumber2: key === 'questionNumber2' ? value : questionNumber2,
        },
      });

      setIsDuplicate(response.data.exists);
    } catch (error) {
      console.error('Error checking question:', error);
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setQuestionMessage('');
    setQuestionError('');

    if (!selectedExam || !selectedExamNumber || !questionNumber1 || !questionNumber2 || !questionText) {
      setQuestionError('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('question/', {
        exam: selectedExam,
        examnumber: selectedExamNumber,
        questionnumber1: questionNumber1,
        questionnumber2: questionNumber2,
        questiontext: questionText,
      });
      onQuestionAdd(response.data);
      setQuestionMessage('질문이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setSelectedExamNumber('');
      setQuestionNumber1('');
      setQuestionNumber2('');
      setQuestionText('');
    } catch (err) {
      setQuestionError(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleExamChange = (e) => {
    const selectedExamId = e.target.value;
    setSelectedExam(selectedExamId);
    setSelectedExamNumber('');
    const filteredNumbers = examNumberList.filter(
      (examNumber) => examNumber.exam?.id === parseInt(selectedExamId)
    );
    setFilteredExamNumbers(filteredNumbers);
  };

  return (
    <Box sx={{ margin: '0 1rem 0 0' }}>
      <Typography variant="h6">Question</Typography>
      <form onSubmit={handleQuestionSubmit}>
        <FormControl fullWidth margin="normal">
          <InputLabel>시험명</InputLabel>
          <Select value={selectedExam} onChange={handleExamChange}>
            {examList.map((exam) => (
              <MenuItem key={exam.id} value={exam.id}>
                {exam.examname}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal" disabled={!selectedExam}>
          <InputLabel>{selectedExam ? '시험회차' : '시험명을 먼저 선택해주세요.'}</InputLabel>
          <Select value={selectedExamNumber} onChange={(e) => setSelectedExamNumber(e.target.value)}>
            {filteredExamNumbers.map((examNumber) => (
              <MenuItem key={examNumber.id} value={examNumber.id}>
                {examNumber.slug}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex' }}>
          <TextField
            sx={{ width: '50%', margin: '1rem 0.5rem 1rem 0' }}
            label="과목 번호"
            variant="outlined"
            value={questionNumber1}
            onChange={(e) => handleQuestionNumberChange('questionNumber1', e.target.value)}
            fullWidth
            margin="normal"
            disabled={!selectedExamNumber}
          />
          <TextField
            sx={{ width: '50%', margin: '1rem 0 1rem 0.5rem' }}
            label="문항 번호"
            variant="outlined"
            value={questionNumber2}
            onChange={(e) => handleQuestionNumberChange('questionNumber2', e.target.value)}
            fullWidth
            margin="normal"
            disabled={!questionNumber1}
          />
        </Box>
        {isDuplicate && (
          <Typography color="red" variant="body2">
            이미 등록된 문항입니다.
          </Typography>
        )}
        <TextField
          label="문항 내용(핵심만 입력바랍니다)"
          variant="outlined"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          fullWidth
          margin="normal"
          disabled={!questionNumber2 || isDuplicate}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isDuplicate || !questionText}
        >
          등록
        </Button>
        {questionMessage && <Typography color="green">{questionMessage}</Typography>}
        {questionError && <Typography color="red">{questionError}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteQuestion;
