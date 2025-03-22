import React, { useState } from 'react';
import { Box, Button, FormControl, Select, InputLabel, MenuItem, Typography, Chip } from '@mui/material';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const StudyWriteExplanation = ({
  examList,
  examNumberList,
  questionList,
  mainsubjectList,
  detailsubjectList,
  selectedExplanation = null, // 선택된 Explanation 데이터
  onSave,
  isEdit = false, // 수정 모드인지 여부

}) => {
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState(selectedExplanation?.exam?.id || '');
  const [selectedExamNumber, setSelectedExamNumber] = useState(selectedExplanation?.examnumber?.id || '');
  const [selectedQuestion, setSelectedQuestion] = useState(selectedExplanation?.question?.id || '');
  const [selectedMainsubjects, setSelectedMainsubjects] = useState(
    selectedExplanation?.mainsubject?.map((ms) => ms.id) || []
  );
  const [selectedDetailsubjects, setSelectedDetailsubjects] = useState(
    selectedExplanation?.detailsubject?.map((ds) => ds.id) || []
  );
  const [explanationText, setExplanationText] = useState(selectedExplanation?.explanation || '');
  const [errorMessage, setErrorMessage] = useState('');

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  const formats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link', 'image'];
  
  // 필터링된 데이터 계산
  const filteredExamNumbers = selectedExam
    ? examNumberList.filter((examNumber) => examNumber.exam?.id === selectedExam)
    : examNumberList;

  const filteredQuestionList = selectedExamNumber
    ? questionList.filter((question) => question.examnumber?.id === selectedExamNumber)
    : questionList;

  const filteredMainsubjects = selectedExam
    ? mainsubjectList.filter((mainsubject) => mainsubject.exam?.id === selectedExam)
    : [];

  const filteredDetailsubjects = selectedMainsubjects.length > 0
    ? detailsubjectList.filter((detailsubject) =>
        selectedMainsubjects.includes(detailsubject.mainslug?.id)
      )
    : detailsubjectList;

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    console.log("Selected Exam:", selectedExam);
    console.log("Selected Exam Number:", selectedExamNumber);
    console.log("Selected Question:", selectedQuestion);
    console.log("Selected Mainsubjects:", selectedMainsubjects);
    console.log("Selected Detailsubjects:", selectedDetailsubjects);
    console.log("Explanation Text:", explanationText);

    // 유효성 검사
    if (!selectedExam || !selectedExamNumber || !selectedQuestion || !explanationText) {
      setErrorMessage('모든 필드를 입력해 주세요.');
      return;
    }

    const requestData = {
      exam: selectedExam,
      examnumber: selectedExamNumber,
      mainsubject: selectedMainsubjects, // 배열 형태 유지
      detailsubject: selectedDetailsubjects, // 배열 형태 유지
      question: selectedQuestion,
      explanation: explanationText,
    };

    try {
      if (isEdit && selectedExplanation?.id) {
        // 수정 모드
        const response = await AxiosInstance.patch(`/explanation/${selectedExplanation.id}/`, requestData);
        if (onSave) onSave(response.data);
        navigate(`/study/view/${selectedExplanation.id}`); // 수정 후 상세 페이지로 이동
      } else {
        // 새 게시글 작성
        const response = await AxiosInstance.post('/explanation/', requestData);
        if (onSave) onSave(response.data);
        navigate(`/study/view/${response.data.id}`); // 작성 후 상세 페이지로 이동
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
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
    <Box sx={{ margin: '1rem' }}>
      <Typography variant="h6">{isEdit ? 'Edit Explanation' : 'Write Explanation'}</Typography>
      <form onSubmit={handleSave}>
        <Box style={{ display: 'flex', gap: '1rem' }}>
          <FormControl fullWidth margin="normal" style={{ width: '20%', margin: '1rem 1rem 1rem 0' }}>
            <InputLabel>시험명</InputLabel>
            <Select
              value={selectedExam}
              onChange={(e) => {
                const examId = Number(e.target.value);
                setSelectedExam(examId);
                setSelectedExamNumber('');
                setSelectedQuestion('');
                setSelectedMainsubjects([]);
                setSelectedDetailsubjects([]);
              }}
            >
              {examList.map((exam) => (
                <MenuItem key={exam.id} value={exam.id}>
                  {exam.examname}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" style={{ width: '40%', margin: '1rem 0 1rem 0' }}>
            <InputLabel>시험회차</InputLabel>
            <Select
              value={selectedExamNumber}
              onChange={(e) => {
                setSelectedExamNumber(e.target.value);
                setSelectedQuestion('');
              }}
              disabled={!selectedExam}
            >
              {filteredExamNumbers.map((examNumber) => (
                <MenuItem key={examNumber.id} value={examNumber.id}>
                  {examNumber.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" style={{ width: '40%', margin: '1rem 0 1rem 1rem' }}>
            <InputLabel>문항</InputLabel>
            <Select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              disabled={!selectedExamNumber}
            >
              {filteredQuestionList.map((question) => (
                <MenuItem key={question.id} value={question.id}>
                  {question.slug}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box style={{ display: 'flex' }}>
          <FormControl fullWidth margin="normal" style={{ width: '50%', margin: '1rem 0 1rem 0' }} disabled={!selectedExam}>
            <InputLabel>주요과목</InputLabel>
            <Select
              multiple
              value={selectedMainsubjects}
              onChange={(e) => setSelectedMainsubjects(e.target.value)}
              input={<OutlinedInput label="주요과목" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {sortByKey(selected, 'mainslug', mainsubjectList).map((value) => {
                    const mainsubject = mainsubjectList.find((ms) => ms.id === value);
                    return <Chip key={value} label={mainsubject ? mainsubject.mainslug : value} />;
                  })}
                </Box>
              )}
            >
              {sortByKey(filteredMainsubjects, 'mainslug').map((mainsubject) => (
                <MenuItem key={mainsubject.id} value={mainsubject.id}>
                  <Checkbox checked={selectedMainsubjects.includes(mainsubject.id)} />
                  <ListItemText primary={mainsubject.mainslug} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" style={{ width: '50%', margin: '1rem 0 1rem 1rem' }}>
            <InputLabel>세부과목</InputLabel>
            <Select
              multiple
              value={selectedDetailsubjects}
              onChange={(e) => setSelectedDetailsubjects(e.target.value)}
              input={<OutlinedInput label="세부과목" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {sortByKey(selected, 'detailslug', detailsubjectList).map((value) => {
                    const detailsubject = detailsubjectList.find((ds) => ds.id === value);
                    return <Chip key={value} label={detailsubject ? detailsubject.detailslug : value} />;
                  })}
                </Box>
              )}
            >
              {sortByKey(filteredDetailsubjects, 'detailslug').map((detailsubject) => (
                <MenuItem key={detailsubject.id} value={detailsubject.id}>
                  <Checkbox checked={selectedDetailsubjects.includes(detailsubject.id)} />
                  <ListItemText primary={detailsubject.detailslug} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <Typography variant="body2">설명 내용</Typography>
          <ReactQuill
            value={explanationText}
            onChange={setExplanationText}
            modules={modules}
            formats={formats}
            style={{ minHeight: '200px', height: '400px', resize: 'vertical' }}
          />
        </Box>

        <Button type="submit" variant="contained" color="primary" fullWidth sx={{ marginTop: '3rem' }}>
          {isEdit ? '수정하기' : '저장하기'}
        </Button>

        {errorMessage && <Typography color="red">{errorMessage}</Typography>}
      </form>
    </Box>
  );
};

export default StudyWriteExplanation;
