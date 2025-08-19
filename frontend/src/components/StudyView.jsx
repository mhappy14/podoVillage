import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';
import { Card, Row, Col, Typography, Button, Pagination, Spin, message } from 'antd';

const { Title, Text } = Typography;

const StudyView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedExplanation, setSelectedExplanation] = useState(null);
  const [explanations, setExplanations] = useState({ results: [] });
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState(null);

  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const explanationArray = explanations.results || [];
  const totalPages = Math.ceil(explanations.length / itemsPerPage);


  const paginatedExplanations = useMemo(() => {
    return explanationArray.slice(indexOfFirstItem, indexOfLastItem);
  }, [explanationArray, indexOfFirstItem, indexOfLastItem]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const explanationRes = await AxiosInstance.get('explanation/');
        setExplanations(explanationRes.data);

        const selectedExplanationRes = await AxiosInstance.get(`explanation/${id}/`);
        setSelectedExplanation(selectedExplanationRes.data);

        const commentRes = await AxiosInstance.get('comment/');
        const filteredComments = (commentRes.data.results || commentRes.data).filter(
          (c) => c.explanation?.id === parseInt(id)
        );
        setComments(filteredComments);

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

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleCommentChange = (e) => setComment(e.target.value);

  const handleCommentSubmit = async () => {
    if (!loggedIn) return message.warning('로그인이 필요합니다.');
    if (!comment.trim()) return message.warning('댓글 내용을 입력하세요.');

    try {
      const res = await AxiosInstance.post('comment/', { content: comment, explanation: selectedExplanation.id });
      setComment('');
      setComments((prev) => [...prev, res.data]);
    } catch (error) {
      console.error('Error posting comment:', error);
      message.error('댓글 작성 실패');
    }
  };

  const handleEditClick = () => {
    navigate(`/study/edit/${id}`, { state: { selectedExplanation } });
  };

  return (
    <div style={{ padding: 20 }}>
      {loading ? (
        <Spin tip="Loading..." />
      ) : selectedExplanation ? (
        <>
          {/* 글 상세 내용 */}
          <Card style={{ marginBottom: 24 }}>
            <Row justify="space-between" align="middle">
              <Col flex="auto">
                <Title level={4} style={{ margin: 0 }}>
                  Q {selectedExplanation.question.questionnumber1}-{selectedExplanation.question.questionnumber2}. {selectedExplanation.question.questiontext}
                </Title>
              </Col>
              <Col style={{ textAlign: 'right' }}>
                <Text strong>{selectedExplanation.exam.examname}</Text> <br />
                <Text>{selectedExplanation.examnumber.examnumber}회 ({selectedExplanation.examnumber.year})</Text> <br />
                <Text>작성자: {selectedExplanation.nickname?.nickname || 'null'}</Text>
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedExplanation.explanation) }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <Text>주요과목: {selectedExplanation.mainsubject.map((s) => s.mainslug).join(', ')}</Text>
              <br />
              <Text>세부과목: {selectedExplanation.detailsubject.map((s) => s.detailslug).join(', ')}</Text>
            </div>

            <Row gutter={16} style={{ marginTop: 16 }}>
              {user && selectedExplanation.nickname && user.id === selectedExplanation.nickname.id && (
                <Col>
                  <Button type="primary" danger onClick={handleEditClick}>수정</Button>
                </Col>
              )}

              <Col>
                {selectedExplanation.is_liked ? (
                  <Button type="default" onClick={async () => {
                    if (!loggedIn) return message.warning('로그인이 필요합니다.');
                    try {
                      await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unlike/`);
                      setSelectedExplanation(prev => ({
                        ...prev,
                        like_count: prev.like_count - 1,
                        is_liked: false
                      }));
                    } catch (error) {
                      message.error('좋아요 취소 실패');
                    }
                  }}>
                    좋아요 취소 {selectedExplanation.like_count}
                  </Button>
                ) : (
                  <Button type="primary" onClick={async () => {
                    if (!loggedIn) return message.warning('로그인이 필요합니다.');
                    try {
                      await AxiosInstance.post(`explanation/${selectedExplanation.id}/like/`);
                      setSelectedExplanation(prev => ({
                        ...prev,
                        like_count: prev.like_count + 1,
                        is_liked: true
                      }));
                    } catch (error) {
                      message.error('좋아요 실패');
                    }
                  }}>
                    좋아요 {selectedExplanation.like_count}
                  </Button>
                )}
              </Col>

              <Col>
                {selectedExplanation.is_bookmarked ? (
                  <Button type="default" onClick={async () => {
                    if (!loggedIn) return message.warning('로그인이 필요합니다.');
                    try {
                      await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unbookmark/`);
                      setSelectedExplanation(prev => ({
                        ...prev,
                        bookmark_count: prev.bookmark_count - 1,
                        is_bookmarked: false
                      }));
                    } catch (error) {
                      message.error('북마크 취소 실패');
                    }
                  }}>
                    북마크 취소 {selectedExplanation.bookmark_count}
                  </Button>
                ) : (
                  <Button type="primary" onClick={async () => {
                    if (!loggedIn) return message.warning('로그인이 필요합니다.');
                    try {
                      await AxiosInstance.post(`explanation/${selectedExplanation.id}/bookmark/`);
                      setSelectedExplanation(prev => ({
                        ...prev,
                        bookmark_count: prev.bookmark_count + 1,
                        is_bookmarked: true
                      }));
                    } catch (error) {
                      message.error('북마크 실패');
                    }
                  }}>
                    북마크 {selectedExplanation.bookmark_count}
                  </Button>
                )}
              </Col>
            </Row>

            {/* 댓글 */}
            <Comments
              filteredComments={comments}
              comment={comment}
              loggedIn={loggedIn}
              handleCommentChange={handleCommentChange}
              handleCommentSubmit={handleCommentSubmit}
            />
          </Card>

          {/* 글 목록 */}
          <div style={{ marginTop: 24 }}>
            {paginatedExplanations.map(item => (
              <Card
                key={item.id}
                hoverable
                style={{
                  marginBottom: 16,
                  backgroundColor: selectedExplanation?.id === item.id ? '#F0F8FF' : 'white'
                }}
                onClick={() => handleBoxClick(item)}
              >
                <Text strong>{item.exam.examname}</Text> {item.examnumber.year}년 {item.examnumber.examnumber}회 Q
                {item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
                <br />
                <Text>좋아요: {item.like.length}개</Text>
              </Card>
            ))}
          </div>

          {/* Pagination 및 Write 버튼 */}
          <Row justify="space-between" align="middle" style={{ marginTop: 24 }}>
            <Col flex="auto" />
            <Col>
              <Pagination current={currentPage} total={explanations.length} pageSize={itemsPerPage} onChange={handlePageChange} />
            </Col>
            <Col>
              <Button type="primary" as={Link} to="/study/write">Write</Button>
            </Col>
          </Row>
        </>
      ) : (
        <Spin tip="Loading..." />
      )}
    </div>
  );
};

export default StudyView;
