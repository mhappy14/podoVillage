// App.jsx
import React from 'react';
import { Routes, Route, useLocation, Outlet } from 'react-router-dom';
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
import Wiki from './components/Wiki';
import WikiView from './components/WikiView';
import WikiVersionList from './components/WikiVersionList';
import WikiVersionView from './components/WikiVersionView';
import WikiEdit from './components/WikiEdit';
import Invest from './components/Invest';
import Mypage from './components/Mypage';
import ProtectedRoute from './components/ProtectedRoutes';
import PasswordResetRequest from './components/PasswordResetRequest';
import PasswordReset from './components/PasswordReset.jsx';

function App() {
  const location = useLocation();
  const cssFile = location.pathname === '/about' ? '/App2.css' : '/App1.css';

  return (
    <>
      <Helmet>
        <link key={cssFile} rel="stylesheet" type="text/css" href={cssFile} />
      </Helmet>

      {/* Navbar 고정 */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', zIndex: 1000 }}>
        <Navbar />
      </div>

      <div>
        <Routes>
          {/* 전체 화면 페이지 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/request/password_reset" element={<PasswordResetRequest />} />
          <Route path="/password-reset/:token" element={<PasswordReset />} />
          <Route path="/about" element={<About />} />

          {/* 고정 폭 페이지 */}
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
                  <Route path="/paper" element={<Paper />} />
                  <Route path="/paper/write" element={<PaperWrite />} />
                  <Route path="/paper/view" element={<PaperView />} />
                  <Route path="/paper/view/:id" element={<PaperView />} />
                  <Route path="/paper/edit/:id" element={<PaperEdit />} />
                  <Route path="/literature" element={<Literature />} />
                  <Route path="/place" element={<Place />} />

                  {/* ✅ 위키: 슬러그 기반 */}
                  <Route path="/wiki" element={<Wiki />} />
                  <Route path="/wiki/v/*" element={<WikiView />} />
                  <Route path="/wiki/v/:title/versionslist" element={<WikiVersionList />} />
                  <Route path="/wiki/v/:title/versionslist/:id" element={<WikiVersionView />} />
                  <Route path="/wiki/*" element={<WikiEdit />} />

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
