import AxiosInstance from './AxiosInstance';
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [userStats, setUserStats] = useState({ posts: 0, totalLikes: 0, totalBookmarks: 0 });

  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('Token');

  // 공통: Axios 응답을 배열로 표준화
  const normalizeList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;
    return [];
  };

  const logoutUser = async () => {
    try {
      await AxiosInstance.post('logoutall/', {}); // 굳이 헤더 덮어쓰지 말기
    } catch (_) {
      // 무시: 토큰 만료 등
    } finally {
      localStorage.removeItem('Token');
      navigate('/');
    }
  };

  useEffect(() => {
    let alive = true;

    const fetchExplanations = async () => {
      try {
        // Authorization을 null로 덮어쓰지 말고, 그냥 기본 인스턴스 사용
        const response = await AxiosInstance.get('explanation/');
        const list = normalizeList(response.data)
          .filter(Boolean);
        const sorted = list.sort(
          (a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
        );
        if (!alive) return;
        setExplanations(sorted.slice(0, 10));
      } catch (error) {
        console.error('Error fetching explanations:', error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    const fetchUserInfo = async () => {
      try {
        // 1순위: 내 정보 전용 엔드포인트가 있으면 사용
        let me = null;
        try {
          const meRes = await AxiosInstance.get('users/me/');
          me = meRes?.data ?? null;
        } catch {
          // 2순위: users 목록에서 첫 번째(또는 토큰과 매칭 가능한 사용자)로 fallback
          const userResponse = await AxiosInstance.get('users/');
          const usersData = normalizeList(userResponse.data);
          me = usersData?.[0] ?? null;
        }

        if (!me) return;
        if (!alive) return;

        setUserInfo(me);

        // 내 글만 필터 — 서버가 쿼리 필터를 지원하면: `explanation/?nickname=<me.id>` 로 호출하는 게 베스트
        const postsRes = await AxiosInstance.get('explanation/');
        const allPosts = normalizeList(postsRes.data);
        const myPosts = allPosts.filter((item) => (item?.nickname?.id ?? item?.nickname) === me.id);

        const totalLikes = myPosts.reduce((sum, post) => sum + (post?.like?.length || 0), 0);
        const totalBookmarks = myPosts.reduce((sum, post) => sum + (post?.bookmark?.length || 0), 0);

        if (!alive) return;
        setUserStats({
          posts: myPosts.length,
          totalLikes,
          totalBookmarks,
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    // 항상 설명 데이터는 불러옴
    fetchExplanations();

    // 로그인 되어 있을 때만 유저 정보/통계
    if (isLoggedIn) {
      fetchUserInfo();
    }

    return () => {
      alive = false;
    };
  }, [isLoggedIn]); // 토큰 변동 시 다시 로드

  return (
    <div>
      <Typography variant="h5" sx={{ mb: '2rem' }}>
        안녕하세요
      </Typography>

      {isLoggedIn ? (
        <>
          <Box sx={{ display: 'flex', gap: '1.4rem' }}>
            <Box sx={{ width: '75%' }}>
              <Typography variant="h6" sx={{ mb: '1rem' }}>최근에 작성된 답안</Typography>
              {loading ? (
                <Typography>Loading data...</Typography>
              ) : (
                explanations.map((item) => (
                  <Box
                    key={item?.id}
                    sx={{ mt: 2, p: '0.8rem', mb: 2, boxShadow: 3, backgroundColor: 'white', color: 'black', cursor: 'pointer' }}
                  >
                    <Link to={`/study/view/${item?.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Typography sx={{ width: '80%' }} variant="subtitle1">
                          <strong>{item?.question?.questiontext ?? '(제목 없음)'}</strong><br />
                          {item?.exam?.examname ?? ''} {item?.examnumber?.year ?? ''}년 {item?.examnumber?.examnumber ?? ''}
                          회 {item?.question?.questionnumber1 ?? ''}과목 {item?.question?.questionnumber2 ?? ''}문항
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'gray', width: '20%', textAlign: 'right' }}>
                          좋아요: {(item?.like?.length ?? 0)}개
                        </Typography>
                      </Box>
                    </Link>
                  </Box>
                ))
              )}
            </Box>

            {userInfo && (
              <Box sx={{ width: '25%' }}>
                <Typography variant="h6" sx={{ mb: '1rem' }}>나의 개인정보</Typography>
                <Box
                  sx={{
                    p: '0.8rem',
                    mb: 2,
                    boxShadow: 3,
                    backgroundColor: 'white',
                    color: 'black',
                    mt: 2,
                    display: 'flex',
                    minHeight: '200px',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <Typography>닉네임: {userInfo?.nickname ?? '-'}</Typography>
                  <Typography>작성한 게시글 수: {userStats.posts}</Typography>
                  <Typography>획득한 좋아요 수: {userStats.totalLikes}</Typography>
                  <Typography>획득한 북마크 수: {userStats.totalBookmarks}</Typography>
                </Box>
                <Box>
                  <Typography
                    component="button"
                    onClick={logoutUser}
                    sx={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 0, p: 0 }}
                  >
                    로그아웃
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </>
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: '1rem' }}>
            로그인 하시면 이 곳에 많은 정보가 표시됩니다.
          </Typography>
        </>
      )}
    </div>
  );
};

export default Home;
