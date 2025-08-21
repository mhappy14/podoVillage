import React, { useState, useEffect } from 'react';
import { Typography, Card } from 'antd';
import AxiosInstance from './AxiosInstance';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';
import StudyWriteExplanation from './StudyWriteExplanation';

const { Title } = Typography;

const StudyWrite = () => {
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);
  const [explanationList, setExplanationList] = useState([]);

  // 데이터 가져오기
  const fetchExams = async () => {
    try {
      const response = await AxiosInstance.get('exam/');
      setExamList(response.data.results || response.data);
    } catch (error) {
      console.error('Exam 데이터 가져오기 오류:', error);
    }
  };

  const fetchExamNumbers = async () => {
    try {
      const response = await AxiosInstance.get('examnumber/');
      setExamNumberList(response.data.results || response.data);
    } catch (error) {
      console.error('ExamNumber 데이터 가져오기 오류:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await AxiosInstance.get('question/');
      setQuestionList(response.data.results || response.data);
    } catch (error) {
      console.error('Question 데이터 가져오기 오류:', error);
    }
  };

  const fetchMainSubjects = async () => {
    try {
      const response = await AxiosInstance.get('mainsubject/');
      setMainsubjectList(response.data.results || response.data);
    } catch (error) {
      console.error('MainSubject 데이터 가져오기 오류:', error);
    }
  };

  const fetchDetailSubjects = async () => {
    try {
      const response = await AxiosInstance.get('detailsubject/');
      setDetailsubjectList(response.data.results || response.data);
    } catch (error) {
      console.error('DetailSubject 데이터 가져오기 오류:', error);
    }
  };

  const fetchExplanations = async () => {
    try {
      const response = await AxiosInstance.get('explanation/');
      setExplanationList(response.data.results || response.data);
    } catch (error) {
      console.error('Explanation 데이터 가져오기 오류:', error);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchExams();
    fetchExamNumbers();
    fetchQuestions();
    fetchMainSubjects();
    fetchDetailSubjects();
    fetchExplanations();
  }, []);

  return (
    <div style={{ padding: '0 1rem 0 1rem' }}>
      <Title level={4} style={{ marginBottom: '0.5rem' }}>
        Register my answer
      </Title>

      {/* 상단 - Explanation */}
      <Card style={{ marginBottom: '2rem', padding: '0' }}>
        <StudyWriteExplanation
          examList={examList}
          examNumberList={examNumberList}
          mainsubjectList={mainsubjectList}
          detailsubjectList={detailsubjectList}
          questionList={questionList}
          onRefresh={fetchExplanations}
          style={{ padding: '0' }}
        />
      </Card>

      {/* 시험명 / 시험회차 / 문항 (1:1:1 비율, gap 1rem) */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Card style={{ flex: 1 }}>
          <StudyWriteExam examList={examList} onExamAdd={fetchExams} />
        </Card>
        <Card style={{ flex: 1 }}>
          <StudyWriteExamnumber
            examList={examList}
            onExamNumberAdd={fetchExamNumbers}
            onRefreshQuestions={fetchQuestions}
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <StudyWriteQuestion
            examList={examList}
            examNumberList={examNumberList}
            onQuestionAdd={(newQuestion) => {
              setQuestionList((prev) => [...prev, newQuestion]); // 즉시 반영
              fetchExplanations(); // Explanation 쪽도 같이 새로고침
            }}
          />
        </Card>
      </div>

      {/* 주요과목 / 세부과목 (1:1 비율, gap 1rem) */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Card style={{ flex: 1 }}>
          <StudyWriteMainsubject
            examList={examList}
            onMainsubjectAdd={fetchMainSubjects}
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <StudyWriteDetailsubject
            examList={examList}
            mainsubjectList={mainsubjectList}
            onDetailsubjectAdd={fetchDetailSubjects}
            onRefreshExplanations={fetchExplanations}
          />
        </Card>
      </div>
    </div>
  );
};

export default StudyWrite;
