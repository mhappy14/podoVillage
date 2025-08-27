import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';
import { Card, Row, Col, Typography, Button, Pagination, Spin, message } from 'antd';

const { Title, Text } = Typography;

// 배열 정규화 헬퍼
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedExplanation, setSelectedExplanation] = useState(null);
  const [explanations, setExplanations] = useState([]); // 배열로 보관
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState(null);

  const itemsPerPage = 10;

  // 최신순 정렬
  const sortedExplanations = useMemo(() => {
    const arr = Array.isArray(explanations) ? explanations : [];
    return arr.slice().sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));
  }, [explanations]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const paginatedExplanations = useMemo(() => {
    return sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);
  }, [sortedExplanations, indexOfFirstItem, indexOfLastItem]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 전체 목록
        const explanationRes = await AxiosInstance.get('explanation/');
        setExplanations(asArray(explanationRes.data));

        // 선택된 글
        const selectedExplanationRes = await AxiosInstance.get(`explanation/${id}/`);
        setSelectedExplanation(selectedExplanationRes.data);

        // 댓글(해당 글로 필터)
        const commentRes = await AxiosInstance.get('comment/');
        const allComments = asArray(commentRes.data);
        const filteredComments = allComments.filter(
          (c) => c?.explanation?.id === Number(id)
        );
        setComments(filteredComments);

        // 로그인 유저
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
      const res = await AxiosInstance.post('comment/', {
        content: comment,
        explanation: selectedExplanation.id,
      });
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
                  {selectedExplanation?.question?.qnumber ?? '-'}-
                  {selectedExplanation?.question?.qnumber ?? '-'}.
                  {' '}
                  {selectedExplanation?.question?.qtext ?? ''}
                </Title>
              </Col>
              <Col style={{ textAlign: 'right' }}>
                <Text strong>{selectedExplanation?.exam?.examname ?? '-'}</Text>{' '}
                <Text>
                  {selectedExplanation?.examnumber?.examnumber ?? '-'}회 (
                  {selectedExplanation?.examnumber?.year ?? '-'})
                </Text>
                <br />
                <Text>작성자: {selectedExplanation?.nickname?.nickname || 'null'}</Text>
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedExplanation?.explanation || ''),
                }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <Text>
                주요과목:{' '}
                {(selectedExplanation?.mainsubject || [])
                  .map((s) => s?.mainslug)
                  .filter(Boolean)
                  .join(', ')}
              </Text>
              <br />
              <Text>
                세부과목:{' '}
                {(selectedExplanation?.detailsubject || [])
                  .map((s) => s?.detailslug)
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </div>

            <Row gutter={16} style={{ marginTop: 16 }}>
              {user && selectedExplanation?.nickname && user.id === selectedExplanation.nickname.id && (
                <Col>
                  <Button type="primary" danger onClick={handleEditClick}>수정</Button>
                </Col>
              )}

              <Col>
                {selectedExplanation?.is_liked ? (
                  <Button
                    type="default"
                    onClick={async () => {
                      if (!loggedIn) return message.warning('로그인이 필요합니다.');
                      try {
                        await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unlike/`);
                        setSelectedExplanation((prev) => ({
                          ...prev,
                          like_count: (prev?.like_count || 1) - 1,
                          is_liked: false,
                        }));
                      } catch (error) {
                        message.error('좋아요 취소 실패');
                      }
                    }}
                  >
                    좋아요 취소 {selectedExplanation?.like_count ?? 0}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!loggedIn) return message.warning('로그인이 필요합니다.');
                      try {
                        await AxiosInstance.post(`explanation/${selectedExplanation.id}/like/`);
                        setSelectedExplanation((prev) => ({
                          ...prev,
                          like_count: (prev?.like_count || 0) + 1,
                          is_liked: true,
                        }));
                      } catch (error) {
                        message.error('좋아요 실패');
                      }
                    }}
                  >
                    좋아요 {selectedExplanation?.like_count ?? 0}
                  </Button>
                )}
              </Col>

              <Col>
                {selectedExplanation?.is_bookmarked ? (
                  <Button
                    type="default"
                    onClick={async () => {
                      if (!loggedIn) return message.warning('로그인이 필요합니다.');
                      try {
                        await AxiosInstance.delete(`explanation/${selectedExplanation.id}/unbookmark/`);
                        setSelectedExplanation((prev) => ({
                          ...prev,
                          bookmark_count: (prev?.bookmark_count || 1) - 1,
                          is_bookmarked: false,
                        }));
                      } catch (error) {
                        message.error('북마크 취소 실패');
                      }
                    }}
                  >
                    북마크 취소 {selectedExplanation?.bookmark_count ?? 0}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!loggedIn) return message.warning('로그인이 필요합니다.');
                      try {
                        await AxiosInstance.post(`explanation/${selectedExplanation.id}/bookmark/`);
                        setSelectedExplanation((prev) => ({
                          ...prev,
                          bookmark_count: (prev?.bookmark_count || 0) + 1,
                          is_bookmarked: true,
                        }));
                      } catch (error) {
                        message.error('북마크 실패');
                      }
                    }}
                  >
                    북마크 {selectedExplanation?.bookmark_count ?? 0}
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
            {paginatedExplanations.map((item) => (
              <Card
                key={item?.id}
                hoverable
                style={{
                  marginBottom: 16,
                  backgroundColor: selectedExplanation?.id === item?.id ? '#F0F8FF' : 'white',
                }}
                onClick={() => handleBoxClick(item)}
              >
                <Text strong>{item?.exam?.examname ?? '-'}</Text>{' '}
                {item?.examnumber?.year ?? '-'}년 {item?.examnumber?.examnumber ?? '-'}회{' '}
                {item?.question?.qsubject ?? '-'}-{item?.question?.qnumber ?? '-'}{' '}
                {item?.question?.qtext ?? ''}
                <br />
                <Text>좋아요: {item?.like_count ?? 0}개</Text>
              </Card>
            ))}
          </div>

          {/* Pagination 및 Write 버튼 */}
          <Row justify="space-between" align="middle" style={{ marginTop: 24 }}>
            <Col flex="auto" />
            <Col>
              <Pagination
                current={currentPage}
                total={sortedExplanations.length}
                pageSize={itemsPerPage}
                onChange={handlePageChange}
              />
            </Col>
            <Col>
              <Button type="primary">
                <Link to="/study/write" style={{ color: 'white' }}>Write</Link>
              </Button>
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
