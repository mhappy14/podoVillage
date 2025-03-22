import AxiosInstance from './AxiosInstance';
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const Home = () => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [userStats, setUserStats] = useState({ posts: 0, totalLikes: 0, totalBookmarks: 0 });


  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const response = await AxiosInstance.get('explanation/', {
          headers: { Authorization: null }, // 인증 없이 데이터 요청
        });
        // 데이터 최신 순으로 정렬
        const sortedExplanations = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        // 상위 10개의 항목만 저장
        setExplanations(sortedExplanations.slice(0, 10));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching explanations:', error);
        setLoading(false);
      }
    };

    const fetchUserInfo = async () => {
      try {
        const userResponse = await AxiosInstance.get('users/');
        const usersData = userResponse.data;
        if (!usersData || usersData.length === 0) return;
        const loggedUser = usersData[0];
        setUserInfo(loggedUser);

        const userPostsResponse = await AxiosInstance.get('explanation/');
        const userPosts = userPostsResponse.data.filter(
          (item) => item.nickname?.id === userResponse.data.id
        );

        const totalLikes = userPosts.reduce((sum, post) => sum + post.like.length, 0);
        const totalBookmarks = userPosts.reduce((sum, post) => sum + post.bookmark.length, 0);

        setUserStats({
          posts: userPosts.length,
          totalLikes,
          totalBookmarks,
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    // 항상 설명 데이터를 가져옴
    fetchExplanations();

    // userInfo 관련 코드는 로그인 되어 있을 때만 실행 (예시: accessToken 존재 여부로 체크)
    if (localStorage.getItem('Token')) {
      fetchUserInfo();
    }
  }, []);

  return (
    <div>
      <Typography variant="h5" sx={{ mb: '2rem' }}>
        안녕하세요
      </Typography>

      <Box sx={{ display: 'flex', gap: '1.4rem'}}>
        <Box sx={{ width:'75%' }}>
          <Box variant="h6" sx={{ mb: '1rem' }}>최근에 작성된 답안</Box>
            {loading ? ( <Typography>Loading data...</Typography>
            ) : (
            explanations.map((item) => (
              <Box key={item.id} sx={{ mt: 2, p: '0.8rem', mb: 2, boxShadow: 3, backgroundColor: 'white', color: 'black', cursor: 'pointer' }}>
                <Link to={`/study/view/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Typography sx={{ width:'80%' }} variant="subtitle1">
                      <strong>{item.question.questiontext}</strong><br />
                      {item.exam.examname} {item.examnumber.year}년 {item.examnumber.examnumber}
                      회 {item.question.questionnumber1}과목 {item.question.questionnumber2}문항
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'gray', width:'20%', textAlign: 'right' }}>
                      좋아요: {item.like.length}개
                    </Typography>
                  </Box>
                </Link>
              </Box>
            )))}
        </Box>
        {userInfo && (
          <Box sx={{ width:'25%' }}>
            <Box variant="h6" sx={{ mb: '1rem' }}>나의 개인정보</Box>
            <Box sx={{ p: '0.8rem', mb: 2, boxShadow: 3, backgroundColor: 'white', color: 'black', 
                       mt: 2, display: 'flex', minHeight: '200px', flexDirection: 'column', gap: '1rem' }}>
              <Typography>닉네임: {userInfo.nickname}</Typography>
              <Typography>작성한 게시글 수: {userStats.posts}</Typography>
              <Typography>획득한 좋아요 수: {userStats.totalLikes}</Typography>
              <Typography>획득한 북마크 수: {userStats.totalBookmarks}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </div>
  );
};

export default Home;
