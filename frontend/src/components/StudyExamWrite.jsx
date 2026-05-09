// =====================================================================
// StudyExamWrite.jsx — 시험문제 등록 전용 페이지
// ---------------------------------------------------------------------
// · 상단: PDF 자동 파싱 (StudyPdfImport)
// · 시험명 / 회차 / 과목 / 문항 / 주요과목 / 세부과목 등록 컴포넌트
// · 해설 작성(StudyWriteExplanation)은 별도 페이지 (/study/write) 에서.
// =====================================================================

import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Space, message } from 'antd';
import { Link } from 'react-router-dom';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import AxiosInstance from './AxiosInstance';
import StudyWriteFromPdf from './StudyWriteFromPdf';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteExamQsubject from './StudyWriteExamQsubject';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';

const { Title, Text } = Typography;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyExamWrite = () => {
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [examQsubjectList, setExamQsubjectList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);

  const fetchExams = async () => {
    try {
      const r = await AxiosInstance.get('exam/');
      setExamList(asArray(r.data));
    } catch (e) {
      console.error('exam 로드 실패:', e);
      message.error('시험명 목록을 불러오지 못했습니다.');
    }
  };
  const fetchExamNumbers = async () => {
    try {
      const r = await AxiosInstance.get('examnumber/');
      setExamNumberList(asArray(r.data));
    } catch (e) {
      console.error('examnumber 로드 실패:', e);
    }
  };
  const fetchExamQsubjects = async () => {
    try {
      const r = await AxiosInstance.get('examqsubject/');
      setExamQsubjectList(asArray(r.data));
    } catch (e) {
      console.error('examqsubject 로드 실패:', e);
    }
  };
  const fetchQuestions = async () => {
    try {
      const r = await AxiosInstance.get('question/');
      setQuestionList(asArray(r.data));
    } catch (e) {
      console.error('question 로드 실패:', e);
    }
  };
  const fetchMainSubjects = async () => {
    try {
      const r = await AxiosInstance.get('mainsubject/');
      setMainsubjectList(asArray(r.data));
    } catch (e) {
      console.error('mainsubject 로드 실패:', e);
    }
  };
  const fetchDetailSubjects = async () => {
    try {
      const r = await AxiosInstance.get('detailsubject/');
      setDetailsubjectList(asArray(r.data));
    } catch (e) {
      console.error('detailsubject 로드 실패:', e);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchExamNumbers();
    fetchExamQsubjects();
    fetchQuestions();
    fetchMainSubjects();
    fetchDetailSubjects();
  }, []);

  return (
    <div style={{ padding: '0 1rem 0 1rem' }}>
      <div
        style={{
          marginBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          시험문제 등록
        </Title>
        <Space>
          <Link to="/study">
            <Button icon={<ArrowLeftOutlined />}>시험 목록</Button>
          </Link>
          <Link to="/study/write">
            <Button type="primary" icon={<EditOutlined />}>
              해설 작성으로 이동
            </Button>
          </Link>
        </Space>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: '0.75rem', fontSize: 12 }}>
        * 시험·회차·과목 등록 후 문항을 추가하거나, 기술사 PDF 를 업로드하여 자동 인식 + 일괄 등록할 수 있습니다.
      </Text>

      {/* PDF 자동 파싱 */}
      <Card style={{ marginBottom: '1rem', padding: 0 }}>
        <StudyWriteFromPdf
          examList={examList}
          onImported={() => {
            fetchExamNumbers();
            fetchExamQsubjects();
            fetchQuestions();
          }}
        />
      </Card>

      {/* 단건 문항 추가 */}
      <Card style={{ marginBottom: '1rem' }}>
        <StudyWriteQuestion
          examList={examList}
          examNumberList={examNumberList}
          examQsubjectList={examQsubjectList}
          onQuestionAdd={(newQuestion) => {
            setQuestionList((prev) => [...prev, newQuestion]);
            fetchQuestions();
          }}
        />
      </Card>

      {/* 시험명 / 시험회차 / 시험과목 (1:1:1) */}
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

      {/* 주요과목 / 세부과목 (1:1) */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Card style={{ flex: 1 }}>
          <StudyWriteMainsubject examList={examList} onMainsubjectAdd={fetchMainSubjects} />
        </Card>
        <Card style={{ flex: 1 }}>
          <StudyWriteDetailsubject
            examList={examList}
            mainsubjectList={mainsubjectList}
            onDetailsubjectAdd={fetchDetailSubjects}
          />
        </Card>
      </div>
    </div>
  );
};

export default StudyExamWrite;
