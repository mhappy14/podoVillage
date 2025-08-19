import * as React from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

export default function Navbar(props) {
  const { content } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const [wikiQ, setWikiQ] = React.useState('');            // ✅ 위키 인라인 검색 상태
  const isWikiRoute = location.pathname.startsWith('/wiki'); // ✅ /wiki 계열일 때만 표시

  const logoutUser = () => {
    AxiosInstance.post(`logoutall/`, {}).then(() => {
      localStorage.removeItem('Token');
      navigate('/');
    });
  };

  const isLoggedIn = localStorage.getItem('Token') !== null; // 로그인 여부 확인

  // 특정 경로가 활성 상태인지 확인
  const isActive = (path) => location.pathname.startsWith(path);

  // 스타일이 적용된 Tab 생성 함수
  const renderTab = (label, path, onClick = null, matchPath = null) => (
    <Tab
      label={label}
      component={path ? Link : 'div'}
      to={path || undefined}
      onClick={onClick || undefined}
      className={`tab ${isActive(matchPath || path) ? 'active' : ''}`}
    />
  );

  // ✅ 위키 인라인 검색 제출
  const handleWikiSearchSubmit = (e) => {
    e.preventDefault();
    const t = wikiQ.trim();
    if (!t) return;
    navigate(`/wiki/v/${encodeURIComponent(t)}`);
    // setWikiQ(''); // 원하면 검색 후 비우기
  };

  return (
    <Box sx={{ width: '100%' }}>
      <div className={"NavBackground"}>
        {/* Home */}
        <Box sx={{ width: '10%', textAlign: 'left', padding: '0 0 0 1.5rem' }}>
          {renderTab('Home', '/home')}
        </Box>

        {/* 중앙: 탭들 */}
        <Box sx={{ width: '70%', textAlign: 'left', display: 'inline-flex', alignItems: 'center' }}>
          {renderTab('About', '/about')}
          {renderTab('Study', '/study', null, '/study')}
          {renderTab('Paper', '/paper', null, '/paper')}
          {renderTab('Art', '/art', null, '/art')}
          {renderTab('Place', '/place', null, '/place')}
          {renderTab('Invest', '/invest', null, '/invest')}
          {renderTab('Wiki', '/wiki', null, '/wiki')}

          {/* ✅ 720px 이상 + /wiki 경로일 때만 Wiki 탭 옆에 검색 표시 */}
          {isWikiRoute && (
            <form className="wiki-inline-search" onSubmit={handleWikiSearchSubmit}>
              <input
                type="text"
                value={wikiQ}
                onChange={(e) => setWikiQ(e.target.value)}
                placeholder="문서 제목"
                aria-label="위키 검색"
              />
              <button type="submit">이동</button>
            </form>
          )}
        </Box>

        {/* 우측: 로그인/로그아웃 */}
        <Box sx={{ width: '15%', textAlign: 'right', padding: '0 1.5rem 0 0' }}>
          {isLoggedIn ? (
            <>
              {renderTab('Mypage', '/mypage')}
              {renderTab('Logout', null, logoutUser)}
            </>
          ) : (
            renderTab('Login', '/login')
          )}
        </Box>
      </div>

      <Box component="main" sx={{ flexGrow: 1, p: 0.5 }}>
        {content}
      </Box>
    </Box>
  );
}