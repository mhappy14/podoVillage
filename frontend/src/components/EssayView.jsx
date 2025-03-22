import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Stack, Pagination, Typography } from '@mui/material';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';

const EssayView = () => {
  const { id } = useParams(); // URL의 id 파라미터
  const navigate = useNavigate();
  const [selectedEssay, setSelectedEssay] = useState(null);
  const [essays, setEssays] = useState([]);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState(null);

  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(essays.length / itemsPerPage);

  const paginatedEssays = useMemo(() => {
    return essays.slice(indexOfFirstItem, indexOfLastItem);
  }, [essays, indexOfFirstItem, indexOfLastItem]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 모든 에세이 가져오기
        const essayRes = await AxiosInstance.get('essay/');
        setEssays(essayRes.data);

        // 선택된 에세이 및 관련 댓글 가져오기
        const selectedEssayRes = await AxiosInstance.get(`essay/${id}/`);
        setSelectedEssay(selectedEssayRes.data);

        // 서버에서 essay ID를 기준으로 필터링된 댓글 가져오기
        const commentRes = await AxiosInstance.get('comment/'); // 전체 댓글 가져오기
        const filteredComments = commentRes.data.filter(
          (comment) => comment.essay?.id === parseInt(id) // essay.id와 URL의 id 비교
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
    navigate(`/essay/view/${item.id}`);
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
      const res = await AxiosInstance.post('comment/', { content: comment, essay: selectedEssay.id });
      setComment('');
      setComments((prev) => [...prev, res.data]);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글 작성 실패');
    }
  };

  const handleEditClick = () => {
    navigate(`/essay/edit/${id}`, { state: { selectedEssay } });
  };

  return (
    <div>
      {/* 글 상세 내용 */}
      {selectedEssay ? (
        <Box sx={{ p: 2, m: 2, boxShadow: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row' }}> {/* 타이틀, 작성자 */}
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <h3 style={{ padding: 0, margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                {selectedEssay.publication.title}
              </h3>
            </div>
            <div style={{ width: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: 0, lineHeight: '1.2' }}>
                <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {selectedEssay.publication.year}년 ({selectedEssay.publication.category})
                </h5>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: '0.3rem 0 0 0', lineHeight: '1.2' }}>
                <h5 style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  작성자 {selectedEssay.nickname ? selectedEssay.nickname.nickname : "null"}
                </h5>
              </div>
            </div>
          </Box>

          {/* 본문 */}
          <Typography
            variant="body1"
            sx={{ marginTop: '1rem', marginBottom: '1rem' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEssay.essay) }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* 수정 */}
            {user && selectedEssay.nickname && user.id === selectedEssay.nickname.id && (
              <Button variant="contained" color="warning" onClick={handleEditClick}>
                수정
              </Button>
            )}

            {/* 좋아요 */}
            <Button variant="contained" color="primary" sx={{ marginLeft: '1rem' }}>
              좋아요 {selectedEssay.likes}
            </Button>

            {/* 북마크 버튼 */}
            <Button variant="contained" color="secondary" sx={{ marginLeft: '1rem' }}>
              북마크 {selectedEssay.bookmarks}
            </Button>
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
        <Typography>Loading essay...</Typography>
      )}

      {/* 글 목록 */}
      <div>
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedEssays.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 2,
                  m: 2,
                  boxShadow: 3,
                  cursor: 'pointer',
                  backgroundColor: selectedEssay?.id === item.id ? '#F0F8FF' : 'white',
                  color: selectedEssay?.id === item.id ? '#5F9EA0' : 'black',
                }}
                onClick={() => handleBoxClick(item)}
              >
                <div>
                  <strong>{item.publication.title}</strong> ({item.publication.year})
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
          <Button component={Link} to="/essay/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EssayView;
