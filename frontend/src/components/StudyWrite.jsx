import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';
import StudyWriteExplanation from './StudyWriteExplanation';

const StudyWrite = () => {
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);
  const [explanationList, setExplanationList] = useState([]);

  // 데이터 가져오기 함수
  const fetchExams = async () => {
    try {
      const response = await AxiosInstance.get('exam/');
      setExamList(response.data);
    } catch (error) {
      console.error('Exam 데이터 가져오기 오류:', error);
    }
  };

  const fetchExamNumbers = async () => {
    try {
      const response = await AxiosInstance.get('examnumber/');
      setExamNumberList(response.data);
    } catch (error) {
      console.error('ExamNumber 데이터 가져오기 오류:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await AxiosInstance.get('question/');
      setQuestionList(response.data);
    } catch (error) {
      console.error('Question 데이터 가져오기 오류:', error);
    }
  };

  const fetchMainSubjects = async () => {
    try {
      const response = await AxiosInstance.get('mainsubject/');
      setMainsubjectList(response.data);
    } catch (error) {
      console.error('MainSubject 데이터 가져오기 오류:', error);
    }
  };

  const fetchDetailSubjects = async () => {
    try {
      const response = await AxiosInstance.get('detailsubject/');
      setDetailsubjectList(response.data);
    } catch (error) {
      console.error('DetailSubject 데이터 가져오기 오류:', error);
    }
  };

  const fetchExplanations = async () => {
    try {
      const response = await AxiosInstance.get('explanation/');
      setExplanationList(response.data);
    } catch (error) {
      console.error('Explanation 데이터 가져오기 오류:', error);
    }
  };

  // 초기에 모든 데이터를 가져옴
  useEffect(() => {
    fetchExams();
    fetchExamNumbers();
    fetchQuestions();
    fetchMainSubjects();
    fetchDetailSubjects();
    fetchExplanations();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="h5" gutterBottom>
        Register my answer
      </Typography>
      <Box sx={{ border: '1px solid #ccc', borderRadius: '8px', margin: '0 0 3rem 0' }}>
        <StudyWriteExplanation
          examList={examList}
          examNumberList={examNumberList}
          mainsubjectList={mainsubjectList}
          detailsubjectList={detailsubjectList}
          questionList={questionList}
          onRefresh={fetchExplanations} // Explanation만 새로고침
        />
      </Box>
      <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: '8px', margin: '1rem 0 1rem 0' }}>
        <Box sx={{ width: '30%', margin: '1rem 1rem 1rem 0' }}>
          <StudyWriteExam examList={examList} onExamAdd={fetchExams} />
        </Box>
        <Box sx={{ width: '35%', margin: '1rem' }}>
          <StudyWriteExamnumber
            examList={examList}
            onExamNumberAdd={fetchExamNumbers} // ExamNumber만 새로고침
            onRefreshQuestions={fetchQuestions} // Question 새로고침
          />
        </Box>
        <Box sx={{ width: '35%', margin: '1rem 0 1rem 1rem' }}>
          <StudyWriteQuestion
            examList={examList}
            examNumberList={examNumberList}
            onQuestionAdd={fetchQuestions} // Question만 새로고침
            onRefreshExplanations={fetchExplanations} // Explanation 새로고침
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: '8px', margin: '1rem 0 1rem 0' }}>
        <Box sx={{ width: '50%', margin: '1rem 1rem 1rem 0' }}>
          <StudyWriteMainsubject examList={examList} onMainsubjectAdd={fetchMainSubjects} />
        </Box>
        <Box sx={{ width: '50%', margin: '1rem 0 1rem 1rem' }}>
          <StudyWriteDetailsubject
            examList={examList}
            mainsubjectList={mainsubjectList}
            onDetailsubjectAdd={fetchDetailSubjects} // DetailSubject만 새로고침
            onRefreshExplanations={fetchExplanations} // Explanation 새로고침
          />
        </Box>
      </Box>
    </div>
  );
};

export default StudyWrite;
