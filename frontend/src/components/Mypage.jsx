import { useState, useEffect } from 'react';
import AxiosInstance from './AxiosInstance'; // AxiosInstance.jsx 파일 경로에 맞게 import
import { TextField, Button, Box, Typography } from '@mui/material'; // MUI의 TextField와 Button, Typography 임포트
import { useNavigate } from 'react-router-dom';

const Mypage = () => {
  const [user, setUser] = useState(null); // 단일 사용자 상태
  const [loading, setLoading] = useState(true); // 로딩 상태
  const [error, setError] = useState(null); // 오류 상태
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    birthday: '',
    username: '',
    address: '',
    phone_number: '',
  });
  const [isEditing, setIsEditing] = useState(false); // 수정 모드 상태

  // 현재 로그인한 사용자 데이터 가져오기
  const fetchCurrentUser = async () => {
    try {
      const userRes = await AxiosInstance.get('users/me/'); // 'users/me/' 엔드포인트를 사용하여 현재 사용자 정보 가져오기
      setUser(userRes.data); // 현재 사용자 정보 저장
      setFormData({
        username: userRes.data.username || '',
        email: userRes.data.email || '',
        nickname: userRes.data.nickname || '',
        birthday: userRes.data.birthday || '',
        address: userRes.data.address || '',
        phone_number: userRes.data.phone_number || '',
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('사용자 데이터를 불러오는 데 실패했습니다.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 폼 입력 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // 폼 제출 핸들러 - 사용자 데이터 업데이트
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await AxiosInstance.put(`users/${user.id}/`, formData); // 사용자 ID를 이용해 PUT 요청
      setUser(response.data);
      alert('프로필이 성공적으로 업데이트되었습니다!');
      setIsEditing(false); // 수정 모드 종료
    } catch (error) {
      console.error('Error updating user data:', error);
      alert('프로필 업데이트에 실패했습니다.');
    }
  };

  const navigate = useNavigate();

  // 회원 탈퇴 핸들러
  const handleDeactivate = async () => {
    try {
      await AxiosInstance.post('users/deactivate/'); // 비활성화 요청
      alert('회원탈퇴 완료');
      localStorage.removeItem('Token'); // 토큰 삭제
      navigate('/home'); // 홈으로 이동
      // 추가적으로 로그아웃 처리 등을 수행
    } catch (err) {
      console.error('Error deactivating account:', err);
      setError('회원탈퇴 실패');
    }
  };

  // 취소 핸들러 - 수정 취소하고 원래 상태로 복귀
  const handleCancel = () => {
    setFormData({
      username: user.username || '',
      email: user.email || '',
      nickname: user.nickname || '',
      birthday: user.birthday || '',
      address: user.address || '',
      phone_number: user.phone_number || '',
    });
    setIsEditing(false);
  };

  // 로딩 중일 때
  if (loading) {
    return <div>Loading...</div>;
  }

  // 오류 상태 처리
  if (error) {
    return <div>{error}</div>;
  }

  // 사용자 데이터가 없을 경우 처리
  if (!user) {
    return <div>사용자 데이터를 찾을 수 없습니다.</div>;
  }

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        마이 페이지
      </Typography>
      {!isEditing ? (
        <Box sx={{ width: '30rem', border: '1px solid grey', padding: '16px', borderRadius: '8px' }}>
          <Typography variant="body1">
            <strong>사용자 이름:&nbsp;&nbsp;&nbsp;</strong> {user.username}
          </Typography>
          <Typography variant="body1">
            <strong>이메일:&nbsp;&nbsp;&nbsp;</strong> {user.email}
          </Typography>
          <Typography variant="body1">
            <strong>닉네임:&nbsp;&nbsp;&nbsp;</strong> {user.nickname}
          </Typography>
          <Typography variant="body1">
            <strong>생년월일:&nbsp;&nbsp;&nbsp;</strong> {user.birthday}
          </Typography>
          <Typography variant="body1">
            <strong>주소:&nbsp;&nbsp;&nbsp;</strong> {user.address}
          </Typography>
          <Typography variant="body1">
            <strong>전화번호:&nbsp;&nbsp;&nbsp;</strong> {user.phone_number}
          </Typography>
          <Button variant="outlined" color="primary" onClick={() => setIsEditing(true)} sx={{ mt: 2, margin: '1rem 1rem 0 0' }}>
            수정
          </Button>
          <Button variant="contained" color="secondary" onClick={handleDeactivate} sx={{ mt: 2, margin: '1rem 0 0 0'   }}>
            회원탈퇴
          </Button>
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          <Box sx={{ border: '1px grey', padding: '16px', borderRadius: '8px' }}>
            <TextField
              label="사용자 이름"
              name="username"
              value={formData.username}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="이메일"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="닉네임"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="생년월일"
              name="birthday"
              type="date"
              value={formData.birthday}
              onChange={handleChange}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }} // 날짜 필드 레이블 유지
              required
            />
            <TextField
              label="주소"
              name="address"
              value={formData.address}
              onChange={handleChange}
              fullWidth
              margin="normal"
            />
            <TextField
              label="전화번호"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              fullWidth
              margin="normal"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button type="submit" variant="contained" color="primary" sx={{ mr: 2 }}>
                프로필 업데이트
              </Button>
              <Button variant="outlined" color="secondary" onClick={handleCancel}>
                취소
              </Button>
            </Box>
          </Box>
        </form>
      )}
    </div>
  );
};

export default Mypage;
