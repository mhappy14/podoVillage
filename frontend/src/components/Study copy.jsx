import React, { useEffect, useMemo, useState } from 'react';
import AxiosInstance from './AxiosInstance';
import { Box, Button, Stack, Pagination, TextField, Typography, Select, MenuItem, InputLabel, FormControl, OutlinedInput } from '@mui/material';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Comments from './Comments';
import WriteExplanation from './WriteExplanation';

const Study = (examList, examNumberList, questionList, mainsubjectList, detailsubjectList) => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExplanation, setSelectedExplanation] = useState(null);
  const [comment, setComment] = useState(''); // 댓글 입력 내용
  const [filteredComments, setFilteredComments] = useState([]); // 현재 선택된 Explanation의 댓글들
  const [loggedIn, setLoggedIn] = useState(false); // 로그인 여부
  const [userData, setuserData] = useState('')
  const [editMode, setEditMode] = useState(false); // 수정 모드 상태
  const [updatedExplanation, setUpdatedExplanation] = useState(''); // 수정할 내용 저장
  const [mainsubject, setMainsubject] = useState(''); // 수정할 mainsubject 저장
  const [detailsubject, setDetailsubject] = useState(''); // 수정할 detailsubject 저장
  const [selectedExam, setSelectedExam] = useState(''); // 선택된 시험
  const [selectedMainsubjects, setSelectedMainsubjects] = useState([]); // 선택된 주요 과목 (배열)
  const [selectedDetailsubjects, setSelectedDetailsubjects] = useState([]); // 선택된 세부 과목 (배열)

  // 사용자 데이터 가져오기
  const GetUserData = () => {
    if (loggedIn) {
      AxiosInstance.get(`users/`).then((res) =>{
        setuserData(res.data)
        console.log(res.data)
      }).catch((error) => {
        console.error('Error fetching user data:', error);
      });
    }
  };

  // Explanation 데이터 가져오기
  const fetchExplanations = async () => {
    try {
      const explanationRes = await AxiosInstance.get('explanation/');
      setExplanations(explanationRes.data);
      console.log(explanationRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching explanations:', error);
      setLoading(false);
    }
  };

  // 댓글 데이터 가져오기
  const fetchComments = async (explanationId) => {
    try {
      const commentRes = await AxiosInstance.get(`comment/?explanation=${explanationId}`);
      setFilteredComments(commentRes.data);
      console.log(commentRes.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  useEffect(() => {
    GetUserData();
    fetchExplanations();
    const token = localStorage.getItem('Token'); // 로그인 여부 확인
    if (token) {
      setLoggedIn(true);
    }
  }, []);

  // 주요과목을 시험에 맞게 필터링
  const filteredMainsubjects = selectedExam
    ? mainsubjectList.filter((mainsubject) => mainsubject.exam?.id === selectedExam)
    : [];

  // 세부과목을 선택된 주요과목에 맞게 필터링
  const filteredDetailsubjects = selectedMainsubjects.length > 0
    ? detailsubjectList.filter((detailsubject) => selectedMainsubjects.includes(detailsubject.mainslug?.id))
    : [];

  // Explanation 클릭 시 해당 Explanation 데이터 및 댓글 가져오기
  const handleBoxClick = async (item) => {
    GetUserData();
    setSelectedExplanation(item); // 클릭한 Explanation 설정
    setEditMode(false);
    setMainsubject(item.mainsubject || ''); // mainsubject 상태 설정
    setDetailsubject(item.detailsubject || '');
    await fetchComments(item.id); // 해당 Explanation의 댓글 가져오기
    await incrementViewCount(item.id); // 클릭 시 view 수 증가
  };

  const handleEditClick = () => {
    setEditMode(true);
    setUpdatedExplanation(selectedExplanation.explanation); // 기존 내용을 수정 입력란에 설정
  };

  const handleExplanationChange = (value) => {
    setUpdatedExplanation(value);
  };

  const handleMainsubjectChange = (e) => {
    setMainsubject(e.target.value);
  };

  const handleDetailsubjectChange = (e) => {
    setDetailsubject(e.target.value);
  };

  const handleExplanationSubmit = async () => {
    try {
      await AxiosInstance.patch(`explanation/${selectedExplanation.id}/`, { explanation: updatedExplanation,
        mainsubject: updatedMainSubject, // mainsubject 업데이트
        detailsubject: updatedDetailSubject });
      setExplanations(prevExplanations =>
        prevExplanations.map(exp => 
          exp.id === selectedExplanation.id ? { ...exp, explanation: updatedExplanation, mainsubject: updatedMainSubject, detailsubject: updatedDetailSubject } : exp
        )
      );
      setSelectedExplanation(prev => ({ ...prev, explanation: updatedExplanation,
        mainsubject: updatedMainSubject,
        detailsubject: updatedDetailSubject  }));
      setEditMode(false);
      alert('Explanation updated successfully');
    } catch (error) {
      console.error('Error updating explanation:', error);
      alert('Failed to update explanation');
    }
  };

  //좋아요
  const handleLikeToggle = async () => {
    if (!loggedIn) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = selectedExplanation.is_liked
        ? await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unlike/`)
        : await AxiosInstance.post(`explanation/${selectedExplanation.id}/like/`);

      setSelectedExplanation(prev => ({
        ...prev,
        is_liked: !prev.is_liked,  // 버튼 상태 토글
        like_count: response.data.like_count,  // 좋아요 수 업데이트
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // view 수 증가 함수 (Explanation 모델에 'view' 필드를 추가하여 구현)
  const incrementViewCount = async (id) => {
    try {
      await AxiosInstance.patch(`explanation/${id}/`, { view: 1 });
      const updatedExplanation = explanations.find(exp => exp.id === id);
      if (updatedExplanation) {
        updatedExplanation.view_count += 1; // 로컬 상태 업데이트
      }
      setSelectedExplanation(updatedExplanation);
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  };

  const handleCommentChange = (e) => {
    setComment(e.target.value);
  };

  const handleCommentSubmit = async () => {
    if (!loggedIn) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!comment.trim()) {
      alert('댓글 내용을 입력하세요.');
      return;
    }

    if (!selectedExplanation) {
      alert('해설을 선택하세요.');
      return;
    }

    const commentData = {
      content: comment,
      explanation: selectedExplanation.id,
    };

    try {
      const res = await AxiosInstance.post('comment/', commentData);
      setComment(''); // 입력란 초기화
      setFilteredComments(prev => [...prev, res.data]); // 새 댓글을 현재 댓글 목록에 추가
      setExplanations(prev => prev.map(exp => exp.id === selectedExplanation.id ? {
        ...exp,
        like_count: exp.like_count, // 필요 시 다른 필드 업데이트
      } : exp));
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글을 작성하는데 실패했습니다.');
    }
  };

  // Pagination 설정
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(explanations.length / itemsPerPage);
  
  const sortedExplanations = useMemo(() => {
    return [...explanations].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [explanations]);
  
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  return (
    <div>
      {/* 클릭된 Explanation의 상세 정보 및 댓글 영역 */}
      {selectedExplanation && (
        <div style={{ marginTop: '20px' }}>
          <Box sx={{ p: 2, m: 2, boxShadow: 3 }}>
            {/* Explanation 상세 정보 */}
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                <h3 style={{ padding: 0, margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  Q {selectedExplanation.question.questionnumber1}-{selectedExplanation.question.questionnumber2}. {selectedExplanation.question.questiontext}
                </h3>
              </div>
              <div style={{ width: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: 0, lineHeight: '1.2' }}>
                  <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{selectedExplanation.exam.examname}</h5>
                  <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {selectedExplanation.examnumber.examnumber}회 ({selectedExplanation.examnumber.year}-{selectedExplanation.examnumber.month})
                  </h5>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: '0.3rem 0 0 0', lineHeight: '1.2' }}>
                  <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                    작성자 {selectedExplanation.nickname ? selectedExplanation.nickname.nickname : "null"}
                  </h5>
                </div>
              </div>
            </Box>

            {/* 해설 내용 */}
            <Box>
              {!editMode ? (
                <div>
                  <div style={{ margin: '0.8rem 0 0 0', borderTop: "1px solid #ccc" }}>
                    <h3 style={{ flex: 3, padding: 0, margin: '0.6rem 0 0 0' }}>Answer</h3>
                    <small style={{ margin: '0.2rem 0 0 0' }}>{selectedExplanation.explanation}</small>
                  </div>
                  <div style={{ display: 'flex', padding: 0, margin: 0 }}>
                    {/* 빈칸 */}
                    <div style={{ width: '33%' }}>
                    </div>
                    {/* 좋아요 */}
                    <div style={{ display: 'flex', margin: '1rem 0 1rem 0', alignItems: 'center', justifyContent: 'center', width: '33%' }}>
                      <Button 
                        variant="contained"
                        color={selectedExplanation.liked_by_user ? "secondary" : "primary"}
                        onClick={handleLikeToggle}
                      >
                      {selectedExplanation.is_liked ? "좋아요 취소" : "좋아요"}
                      </Button>
                      <Typography variant="body2" sx={{ marginLeft: '10px' }}>
                      {selectedExplanation.like_count} likes
                      </Typography>
                    </div>
                    {/* 게시글 수정 */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '33%' }}>
                      {/* 작성자가 조회한 경우 수정 버튼 추가 */}
                      {loggedIn && selectedExplanation.nickname && selectedExplanation.nickname.id === userData[0].id && (
                        <Button variant="contained" color="warning" onClick={handleEditClick} sx={{ mt: 2 }} disabled={editMode}>
                          수정
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '600px' }}>
                  <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                    <InputLabel id="mainsubject-label">주요 과목</InputLabel>
                    <Select
                      multiple
                      labelId="mainsubject-label"
                      value={selectedMainsubjects}
                      onChange={handleMainsubjectChange}
                      label="주요 과목"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const mainsubject = mainsubjectList.find((ms) => ms.id === value);
                            return <Chip key={value} label={mainsubject ? mainsubject.mainslug : value} />;
                          })}
                        </Box>
                      )}
                    >
                    {filteredMainsubjects.sort((a, b) => a.mainslug.localeCompare(b.mainslug)).map((mainsubject) => (
                      <MenuItem key={mainsubject.id} value={mainsubject.id}>
                        <Checkbox checked={selectedMainsubjects.indexOf(mainsubject.id) > -1} />
                        <ListItemText primary={mainsubject.mainslug} />
                      </MenuItem>
                    ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                    <InputLabel id="detailsubject-label">세부 과목</InputLabel>
                    <Select
                      multiple
                      labelId="detailsubject-label"
                      value={selectedDetailsubjects}
                      onChange={handleDetailsubjectChange}
                      label="세부 과목"
                    >
                    {filteredDetailsubjects.sort((a, b) => a.detailslug.localeCompare(b.detailslug)).map((detailsubject) => (
                      <MenuItem key={detailsubject.id} value={detailsubject.id}>
                        <Checkbox checked={selectedDetailsubjects.indexOf(detailsubject.id) > -1} />
                        <ListItemText primary={detailsubject.detailslug} />
                      </MenuItem>
                    ))}
                    </Select>
                  </FormControl>
                  <Box margin="normal" sx={{ mb: 8 }}>
                    <Typography variant="body2">설명 내용</Typography>
                    <ReactQuill
                      value={updatedExplanation}
                      onChange={handleExplanationChange}
                      modules={{
                        toolbar: [
                          [{ header: '1'}, { header: '2'}, { font: [] }],
                          [{ list: 'ordered'}, { list: 'bullet' }],
                          ['bold', 'italic', 'underline'],
                          ['link'],
                          [{ align: [] }],
                          ['clean'],
                        ],
                      }}
                      theme="snow"
                      style={{ minHeight: '200px', height: '300px' }}
                    />
                  </Box>
                  <Button variant="contained" color="primary" onClick={handleExplanationSubmit} sx={{ mt: 1, width: '100%' }}>
                    저장
                  </Button>
                </div>
              )}
            </Box>

            {/* 댓글 섹션 */}
            <Comments
              filteredComments={filteredComments}
              comment={comment}
              loggedIn={loggedIn}
              handleCommentChange={handleCommentChange}
              handleCommentSubmit={handleCommentSubmit}
            />
          </Box>
        </div>
      )}

      {/* Explanation 목록 */}
      <div>
        {loading ? <p>Loading data...</p> :
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedExplanations.map((item) => (
              <Box
                key={item.id}
                sx={{ p: 2, m: 2, boxShadow: 3, cursor: 'pointer', backgroundColor: selectedExplanation?.id === item.id ? '#F0F8FF' : 'white', color: selectedExplanation?.id === item.id ? '#5F9EA0' : 'black' }}
                onClick={() => handleBoxClick(item)}
              >
                <div>
                  <strong>{item.exam.examname}</strong> {item.examnumber.examnumber}회 {item.examnumber.year}년 Q{item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
                  <br />
                  좋아요: {item.like.length}개
                </div>
              </Box>
            ))}
          </div>
        }
      </div>

      {/* Pagination 및 Write 버튼 */}
      <div style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        </div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Stack spacing={2}>
            <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
          </Stack>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button component={Link} to="/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Study;
