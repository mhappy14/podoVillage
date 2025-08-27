import React, { useState, useEffect } from 'react';
import { Typography, Card, message } from 'antd';
import AxiosInstance from './AxiosInstance';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteExamQsubject from './StudyWriteExamQsubject';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';
import StudyWriteExplanation from './StudyWriteExplanation';

const { Title } = Typography;

// 배열/페이징 응답 정규화
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyWrite = () => {
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [examQsubjectList, setExamQsubjectList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);
  const [explanationList, setExplanationList] = useState([]);

  // 데이터 가져오기
  const fetchExams = async () => {
    try {
      const res = await AxiosInstance.get('exam/');
      setExamList(asArray(res.data));
    } catch (error) {
      console.error('Exam 데이터 가져오기 오류:', error);
      message.error('시험명 목록을 불러오지 못했습니다.');
    }
  };

  const fetchExamNumbers = async () => {
    try {
      const res = await AxiosInstance.get('examnumber/');
      setExamNumberList(asArray(res.data));
    } catch (error) {
      console.error('ExamNumber 데이터 가져오기 오류:', error);
      message.error('시험회차 목록을 불러오지 못했습니다.');
    }
  };

  const fetchExamQsubjects = async () => {
    try {
      const res = await AxiosInstance.get('examqsubject/');
      setExamQsubjectList(asArray(res.data));
    } catch (error) {
      console.error('ExamQsubject 데이터 가져오기 오류:', error);
      message.error('시험 과목 목록을 불러오지 못했습니다.');
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await AxiosInstance.get('question/');
      setQuestionList(asArray(res.data));
    } catch (error) {
      console.error('Question 데이터 가져오기 오류:', error);
      message.error('문항 목록을 불러오지 못했습니다.');
    }
  };

  const fetchMainSubjects = async () => {
    try {
      const res = await AxiosInstance.get('mainsubject/');
      setMainsubjectList(asArray(res.data));
    } catch (error) {
      console.error('MainSubject 데이터 가져오기 오류:', error);
      message.error('주요과목 목록을 불러오지 못했습니다.');
    }
  };

  const fetchDetailSubjects = async () => {
    try {
      const res = await AxiosInstance.get('detailsubject/');
      setDetailsubjectList(asArray(res.data));
    } catch (error) {
      console.error('DetailSubject 데이터 가져오기 오류:', error);
      message.error('세부과목 목록을 불러오지 못했습니다.');
    }
  };

  const fetchExplanations = async () => {
    try {
      const res = await AxiosInstance.get('explanation/');
      setExplanationList(asArray(res.data));
    } catch (error) {
      console.error('Explanation 데이터 가져오기 오류:', error);
      message.error('해설 목록을 불러오지 못했습니다.');
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchExams();
    fetchExamNumbers();
    fetchExamQsubjects();
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
      <Card style={{ marginBottom: '1rem', padding: 0 }}>
        <StudyWriteExplanation
          examList={examList}
          examNumberList={examNumberList}
          mainsubjectList={mainsubjectList}
          detailsubjectList={detailsubjectList}
          questionList={questionList}
          onRefresh={fetchExplanations}
          style={{ padding: 0 }}
        />
      </Card>

      <Card style={{ flex: 1, marginBottom: '1rem' }}>
        <StudyWriteQuestion
          examList={examList}
          examNumberList={examNumberList}
          examQsubjectList={examQsubjectList}
          onQuestionAdd={(newQuestion) => {
            // 즉시 반영(자식에서 정규화된 객체가 넘어온다는 가정)
            setQuestionList((prev) => [...prev, newQuestion]);
            // Explanation도 함께 갱신
            fetchExplanations();
          }}
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
          <StudyWriteExamQsubject
            examList={examList}
            onQsubjectAdd={(newItem) => {
              setExamQsubjectList((prev) => [newItem, ...prev]);
              fetchExamQsubjects();
              fetchQuestions();
            }}
          />
        </Card>
      </div>

      {/* 주요과목 / 세부과목 (1:1 비율, gap 1rem) */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Card style={{ flex: 1 }}>
          <StudyWriteMainsubject examList={examList} onMainsubjectAdd={fetchMainSubjects} />
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
