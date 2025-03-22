import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import AxiosInstance from './AxiosInstance';
import StudyWriteExam from './StudyWriteExam';
import StudyWriteExamnumber from './StudyWriteExamnumber';
import StudyWriteQuestion from './StudyWriteQuestion';
import StudyWriteMainsubject from './StudyWriteMainsubject';
import StudyWriteDetailsubject from './StudyWriteDetailsubject';
import StudyWriteExplanation from './StudyWriteExplanation';
import { useParams, useNavigate } from 'react-router-dom';

const StudyEdit = () => {
  const { id } = useParams(); // URL에서 게시글 ID 가져오기
  const navigate = useNavigate();
  const [examList, setExamList] = useState([]);
  const [examNumberList, setExamNumberList] = useState([]);
  const [questionList, setQuestionList] = useState([]);
  const [mainsubjectList, setMainsubjectList] = useState([]);
  const [detailsubjectList, setDetailsubjectList] = useState([]);
  const [selectedExplanation, setSelectedExplanation] = useState(null); // 선택된 게시글 데이터

  // 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exams, examNumbers, questions, mainSubjects, detailSubjects, explanation] = await Promise.all([
          AxiosInstance.get('exam/'),
          AxiosInstance.get('examnumber/'),
          AxiosInstance.get('question/'),
          AxiosInstance.get('mainsubject/'),
          AxiosInstance.get('detailsubject/'),
          AxiosInstance.get(`explanation/${id}/`), // 선택된 게시글 데이터
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
      alert('게시글이 성공적으로 수정되었습니다.');
      navigate(`/study/view/${id}`); // 수정 후 상세보기 페이지로 이동
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      alert('게시글 수정 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="h5" gutterBottom>
        Edit My Answer
      </Typography>
      {selectedExplanation && (
        <>
          <Box sx={{ border: '1px solid #ccc', borderRadius: '8px', margin: '0 0 3rem 0' }}>
            <StudyWriteExplanation
              examList={examList}
              examNumberList={examNumberList}
              mainsubjectList={mainsubjectList}
              detailsubjectList={detailsubjectList}
              questionList={questionList}
              selectedExplanation={selectedExplanation} // 선택된 게시글 데이터 전달
              onSave={handleSave} // 저장 시 호출
              isEdit={true} // 수정 모드 활성화
            />
          </Box>
          <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: '8px', margin: '1rem 0 1rem 0' }}>
            <Box sx={{ width: '30%', margin: '1rem 1rem 1rem 0' }}>
              <StudyWriteExam examList={examList} />
            </Box>
            <Box sx={{ width: '35%', margin: '1rem' }}>
              <StudyWriteExamnumber examList={examList} />
            </Box>
            <Box sx={{ width: '35%', margin: '1rem 0 1rem 1rem' }}>
              <StudyWriteQuestion examList={examList} examNumberList={examNumberList} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: '8px', margin: '1rem 0 1rem 0' }}>
            <Box sx={{ width: '50%', margin: '1rem 1rem 1rem 0' }}>
              <StudyWriteMainsubject examList={examList} />
            </Box>
            <Box sx={{ width: '50%', margin: '1rem 0 1rem 1rem' }}>
              <StudyWriteDetailsubject examList={examList} mainsubjectList={mainsubjectList} />
            </Box>
          </Box>
        </>
      )}
    </div>
  );
};

export default StudyEdit;
