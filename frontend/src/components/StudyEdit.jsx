import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Card, message } from 'antd';
import AxiosInstance from './AxiosInstance';
import StudyWriteExplanation from './StudyWriteExplanation';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

const StudyEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);
  const [selectedExplanation, setSelectedExplanation] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exams, examNumbers, questions, mainSubjects, detailSubjects, explanation] = await Promise.all([
          AxiosInstance.get('exam/'),
          AxiosInstance.get('examnumber/'),
          AxiosInstance.get('question/'),
          AxiosInstance.get('mainsubject/'),
          AxiosInstance.get('detailsubject/'),
          AxiosInstance.get(`explanation/${id}/`),
        ]);

        setExamList(exams.data);
        setExamNumberList(examNumbers.data);
        setQuestionList(questions.data);
        setMainsubjectList(mainSubjects.data);
        setDetailsubjectList(detailSubjects.data);
        setSelectedExplanation(explanation.data);
      } catch (error) {
        console.error('데이터 가져오기 오류:', error);
      }
    };

    fetchData();
  }, [id]);

  const handleSave = async (updatedData) => {
    try {
      await AxiosInstance.patch(`explanation/${id}/`, updatedData);
      message.success('게시글이 성공적으로 수정되었습니다.');
      navigate(`/study/view/${id}`);
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      message.error('게시글 수정 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Title level={4}>Edit My Answer</Title>

      {selectedExplanation && (
        <>
          {/* Explanation Card */}
          <Card style={{ marginBottom: 24 }}>
            <StudyWriteExplanation
              examList={examList}
              examNumberList={examNumberList}
              mainsubjectList={mainsubjectList}
              detailsubjectList={detailsubjectList}
              questionList={questionList}
              selectedExplanation={selectedExplanation}
              onSave={handleSave}
              isEdit={true}
            />
          </Card>

          {/* 시험명 / 시험회차 / 문항 */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <StudyWriteExam examList={examList} />
              </Col>
              <Col span={8}>
                <StudyWriteExamnumber examList={examList} />
              </Col>
              <Col span={8}>
                <StudyWriteQuestion examList={examList} examNumberList={examNumberList} />
              </Col>
            </Row>
          </Card>

          {/* 주요과목 / 세부과목 */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={12}>
                <StudyWriteMainsubject examList={examList} />
              </Col>
              <Col span={12}>
                <StudyWriteDetailsubject examList={examList} mainsubjectList={mainsubjectList} />
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
};

export default StudyEdit;
