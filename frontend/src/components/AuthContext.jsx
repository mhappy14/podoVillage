// src/components/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AxiosInstance from './AxiosInstance';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // 현재 사용자 상태를 관리
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('Token') !== null
  );
  const [authReady, setAuthReady] = useState(false);

  // 앱 시작 시 localStorage 의 토큰이 "실제로 유효한지" 백엔드로 검증한다.
  // 서버를 재시작하면 토큰 테이블이 초기화돼 localStorage 에 남은 토큰이 무효해지는데,
  // 이를 검증하지 않으면 토큰 문자열만 보고 로그인된 것처럼 표시되는 문제가 생긴다.
  useEffect(() => {
    const token = localStorage.getItem('Token');
    if (!token) {
      setIsAuthenticated(false);
      setAuthReady(true);
      return;
    }
    AxiosInstance.get('users/me/')
      .then((res) => {
        setUser(res.data);
        setIsAuthenticated(true);
      })
      .catch(() => {
        // 무효한 토큰은 깨끗이 제거 → 로그인 안 된 상태로 처리
        localStorage.removeItem('Token');
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setAuthReady(true));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, isAuthenticated, setIsAuthenticated, authReady }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
