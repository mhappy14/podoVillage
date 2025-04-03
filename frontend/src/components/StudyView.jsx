import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Stack, Pagination, Typography } from '@mui/material';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';

const StudyView = () => {
  const { id } = useParams(); // URL의 id 파라미터
  const navigate = useNavigate();
  const [selectedExplanation, setSelectedExplanation] = useState(null);
  const [explanations, setExplanations] = useState([]);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState(null);

  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(explanations.length / itemsPerPage);

  const paginatedExplanations = useMemo(() => {
    return explanations.slice(indexOfFirstItem, indexOfLastItem);
  }, [explanations, indexOfFirstItem, indexOfLastItem]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 전체 설명 데이터 가져오기
        const explanationRes = await AxiosInstance.get('explanation/');
        setExplanations(explanationRes.data);

        // 선택된 설명 및 댓글 가져오기
        const selectedExplanationRes = await AxiosInstance.get(`explanation/${id}/`);
        setSelectedExplanation(selectedExplanationRes.data);

        // 서버에서 explanation ID를 기준으로 필터링된 댓글 가져오기
        const commentRes = await AxiosInstance.get('comment/'); // 전체 댓글 가져오기
        const filteredComments = commentRes.data.filter(
          (comment) => comment.explanation?.id === parseInt(id) // Paper.id와 URL의 id 비교
        );
        setComments(filteredComments);

        // 사용자 정보 가져오기
        const token = localStorage.getItem('Token');
        if (token) {
          const userRes = await AxiosInstance.get('users/me/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(userRes.data);
          setLoggedIn(true);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleBoxClick = (item) => {
    navigate(`/study/view/${item.id}`);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
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

    try {
      const res = await AxiosInstance.post('comment/', { content: comment, explanation: selectedExplanation.id });
      setComment('');
      setComments((prev) => [...prev, res.data]);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글 작성 실패');
    }
  };

  const handleEditClick = () => {
    navigate(`/study/edit/${id}`, { state: { selectedExplanation } }); // 선택된 데이터를 전달
  };
  
  return (
    <div>
      {/* 글 상세 내용 */}
      {selectedExplanation ? (
        <Box sx={{ p: 2, m: 2, boxShadow: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row' }}> {/* 타이틀, 작성자 */}
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <h3 style={{ padding: 0, margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                Q {selectedExplanation.question.questionnumber1}-{selectedExplanation.question.questionnumber2}. {selectedExplanation.question.questiontext}
              </h3>
            </div>
            <div style={{ width: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: 0, lineHeight: '1.2' }}>
                <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{selectedExplanation.exam.examname}</h5>
                <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {selectedExplanation.examnumber.examnumber}회 ({selectedExplanation.examnumber.year})
                </h5>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: '0.3rem 0 0 0', lineHeight: '1.2' }}>
                <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  작성자 {selectedExplanation.nickname ? selectedExplanation.nickname.nickname : "null"}
                </h5>
              </div>
            </div>
          </Box>

          {/* 본문 */}
          <Typography
            variant="body1"
            sx={{ marginTop: '1rem', marginBottom: '1rem' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedExplanation.explanation) }}
          />

          {/* 해당과목 */}
          <Typography>
            주요과목: {selectedExplanation.mainsubject.map((subject) => subject.mainslug).join(', ')}
            <br />
            세부과목: {selectedExplanation.detailsubject.map((subject) => subject.detailslug).join(', ')}
          </Typography>

          <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}> 
            {/* 수정 */}
            {user && selectedExplanation.nickname && user.id === selectedExplanation.nickname.id && (
              <Button variant="contained" color="warning" onClick={handleEditClick}>
                수정
              </Button>
            )}

            {/* 좋아요 */}
            {selectedExplanation.is_liked ? (
              <Button
                variant="contained"
                color="secondary"
                sx={{ marginLeft: '1rem' }}
                onClick={async () => {
                  if (!loggedIn) {
                    alert('로그인이 필요합니다.');
                    return;
                  }
                  try {
                    await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unlike/`);
                    // 좋아요 상태를 업데이트합니다.
                    setSelectedExplanation((prev) => ({
                      ...prev,
                      like_count: prev.like_count - 1,
                      is_liked: false, // 좋아요 상태 업데이트
                    }));
                  } catch (error) {
                    console.error('좋아요 취소 처리 중 오류:', error);
                    alert('좋아요 취소 처리에 실패했습니다.');
                  }
                }}
              >
                좋아요 취소 {selectedExplanation.like_count}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                sx={{ marginLeft: '1rem' }}
                onClick={async () => {
                  if (!loggedIn) {
                    alert('로그인이 필요합니다.');
                    return;
                  }
                  try {
                    await AxiosInstance.post(`explanation/${selectedExplanation.id}/like/`);
                    // 좋아요 상태를 업데이트합니다.
                    setSelectedExplanation((prev) => ({
                      ...prev,
                      like_count: prev.like_count + 1,
                      is_liked: true, // 좋아요 상태 업데이트
                    }));
                  } catch (error) {
                    console.error('좋아요 처리 중 오류:', error);
                    alert('좋아요 처리에 실패했습니다.');
                  }
                }}
              >
                좋아요 {selectedExplanation.like_count}
              </Button>
            )}

            {/* 북마크 버튼 */}
            {selectedExplanation.is_bookmarked ? (
              <Button
                variant="contained"
                color="secondary"
                sx={{ marginLeft: '1rem' }}
                onClick={async () => {
                  if (!loggedIn) {
                    alert('로그인이 필요합니다.');
                    return;
                  }
                  try {
                    await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unbookmark/`);
                    setSelectedExplanation((prev) => ({
                      ...prev,
                      bookmark_count: prev.bookmark_count - 1,
                      is_bookmarked: false,
                    }));
                  } catch (error) {
                    console.error('북마크 취소 처리 중 오류:', error);
                    alert('북마크 취소 처리에 실패했습니다.');
                  }
                }}
              >
                북마크 취소 {selectedExplanation.bookmark_count}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                sx={{ marginLeft: '1rem' }}
                onClick={async () => {
                  if (!loggedIn) {
                    alert('로그인이 필요합니다.');
                    return;
                  }
                  try {
                    await AxiosInstance.post(`explanation/${selectedExplanation.id}/bookmark/`);
                    setSelectedExplanation((prev) => ({
                      ...prev,
                      bookmark_count: prev.bookmark_count + 1,
                      is_bookmarked: true,
                    }));
                  } catch (error) {
                    console.error('북마크 처리 중 오류:', error);
                    alert('북마크 처리에 실패했습니다.');
                  }
                }}
              >
                북마크 {selectedExplanation.bookmark_count}
              </Button>
            )}
          </Box>

          {/* 댓글 */}
          <Comments
            filteredComments={comments}
            comment={comment}
            loggedIn={loggedIn}
            handleCommentChange={handleCommentChange}
            handleCommentSubmit={handleCommentSubmit}
          />
        </Box>
      ) : (
        <Typography>Loading explanation...</Typography>
      )}

      {/* 글 목록 */}
      <div>
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedExplanations.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 2,
                  m: 2,
                  boxShadow: 3,
                  cursor: 'pointer',
                  backgroundColor: selectedExplanation?.id === item.id ? '#F0F8FF' : 'white',
                  color: selectedExplanation?.id === item.id ? '#5F9EA0' : 'black',
                }}
                onClick={() => handleBoxClick(item)}
              >
                <div>
                  <strong>{item.exam.examname}</strong> {item.examnumber.year}년 {item.examnumber.examnumber}회 Q
                  {item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
                  <br />
                  좋아요: {item.like.length}개
                </div>
              </Box>
            ))}
          </div>
        )}
      </div>

      {/* Pagination 및 Write 버튼 */}
      <div style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Stack spacing={2}>
            <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
          </Stack>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button component={Link} to="/study/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudyView;
