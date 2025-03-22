import * as React from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import { Link, useLocation } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import { useNavigate } from 'react-router-dom';

export default function Navbar(props) {
  const { content } = props;
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <Box sx={{ width: '100%' }}>
      <div className={"NavBackground"}>
        {/* Home - 20% */}
        <Box sx={{ width: '10%', textAlign: 'left', padding: '0 0 0 1.5rem' }}>
          {renderTab('Home', '/home')}
        </Box>

        {/* About, Study - 60% */}
        <Box sx={{ width: '60%', textAlign: 'left' }}>
          {renderTab('About', '/about')}
          {renderTab('Study', '/study', null, '/study')} {/* /study 경로 시작 여부 확인 */}
          {renderTab('Essay', '/essay', null, '/essay')} 
          {renderTab('Review', '/review', null, '/review')} 
          {renderTab('Place', '/place', null, '/place')} 
          {renderTab('Knowhow', '/knowhow', null, '/knowhow')} 
          {renderTab('Invest', '/invest', null, '/invest')} 
        </Box>

        {/* Mypage, Logout - 20% */}
        <Box sx={{ width: '30%', textAlign: 'right', padding: '0 1.5rem 0 0' }}>
          {isLoggedIn
            ? (
              <>
                {renderTab('Mypage', '/mypage')}
                {renderTab('Logout', null, logoutUser)}
              </>
            )
            : renderTab('Login', '/login')}
        </Box>
        </div>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {content}
      </Box>
    </Box>
  );
}
