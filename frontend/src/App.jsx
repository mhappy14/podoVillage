import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Register from './components/Register';
import Login from './components/Login';
import About from './components/About';
import Study from './components/Study';
import StudyView from './components/StudyView';
import StudyEdit from './components/StudyEdit';
import StudyWrite from './components/StudyWrite';
import Paper from './components/Paper';
import PaperWrite from './components/PaperWrite';
import PaperView from './components/PaperView';
import PaperEdit from './components/PaperEdit';
import Literature from './components/Literature';
import Place from './components/Place';
import Knowhow from './components/Knowhow';
import Invest from './components/Invest';
import Mypage from './components/Mypage';
import ProtectedRoute from './components/ProtectedRoutes';
import PasswordResetRequest from './components/PasswordResetRequest';
import PasswordReset from './components/PasswordReset.jsx';

function App() {
  const location = useLocation();
  // 경로가 '/about'이면 App2.css, 아니면 App1.css를 적용
  const cssFile = location.pathname === '/about' ? '/App2.css' : '/App1.css';

  return (
    <>
      <Helmet>
        <link key={cssFile} rel="stylesheet" type="text/css" href={cssFile} />
      </Helmet>

      {/* Navbar를 고정시킴 */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', zIndex: 1000 }}>
        <Navbar />
      </div>

      {/* Navbar 높이만큼 상단 여백 추가 */}
      <div>
        <Routes>
          {/* 최대 폭 제한 없이 전체 화면을 사용하는 페이지 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/request/password_reset" element={<PasswordResetRequest />} />
          <Route path="/password-reset/:token" element={<PasswordReset />} />
          <Route path="/about" element={<About />} /> 

          {/* 최대 폭 1248px로 제한되는 페이지 */}
          <Route
            path="/*"
            element={
              <div className="contents">
                <Routes>
                  <Route path="/home" element={<Home />} />
                  <Route path="/study" element={<Study />} />
                  <Route path="/study/write" element={<StudyWrite />} />
                  <Route path="/study/view/:id" element={<StudyView />} />
                  <Route path="/study/edit/:id" element={<StudyEdit />} />
                  <Route path="/Paper" element={<Paper />} />
                  <Route path="/Paper/write" element={<PaperWrite />} />
                  <Route path="/Paper/view" element={<PaperView />} />
                  <Route path="/Paper/view/:id" element={<PaperView />} />
                  <Route path="/Paper/edit/:id" element={<PaperEdit />} />
                  <Route path="/Literature" element={<Literature />} />
                  <Route path="/place" element={<Place />} />
                  <Route path="/knowhow" element={<Knowhow />} />
                  <Route path="/invest" element={<Invest />} />
                  <Route path="/mypage" element={<Mypage />} />
                </Routes>
              </div>
            }
          />
        </Routes>
      </div>
    </>
  );
}

export default App;
