import { useState, useEffect } from 'react';
import AxiosInstance from './AxiosInstance';
import { useNavigate } from 'react-router-dom';
import { FIELDS } from '../utils/studyExamConfig';

const STORAGE_KEY = 'selectedExams';   // 다중 선택: JSON 배열
const LEGACY_KEY = 'selectedExam';     // 구버전 단일 문자열 호환

const loadExams = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {
    /* noop */
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  return legacy ? [legacy] : [];
};

const Mypage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    birthday: '',
    username: '',
    address: '',
    phone_number: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedExams, setSelectedExams] = useState(loadExams);

  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    try {
      const userRes = await AxiosInstance.get('users/me/');
      setUser(userRes.data);
      setFormData({
        username: userRes.data.username || '',
        email: userRes.data.email || '',
        nickname: userRes.data.nickname || '',
        birthday: userRes.data.birthday || '',
        address: userRes.data.address || '',
        phone_number: userRes.data.phone_number || '',
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('사용자 데이터를 불러오는 데 실패했습니다.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const persistExams = (list) => {
    setSelectedExams(list);
    if (list.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    else localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY); // 구버전 키 정리
  };

  const handleExamAdd = (e) => {
    const value = e.target.value;
    e.target.value = ''; // 셀렉트는 항상 placeholder 로 되돌림
    if (!value || selectedExams.includes(value)) return;
    persistExams([...selectedExams, value]);
  };

  const handleExamRemove = (item) => {
    persistExams(selectedExams.filter((x) => x !== item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await AxiosInstance.put(`users/${user.id}/`, formData);
      setUser(response.data);
      alert('프로필이 성공적으로 업데이트되었습니다!');
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating user data:', err);
      alert('프로필 업데이트에 실패했습니다.');
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('정말 회원탈퇴 하시겠습니까?')) return;
    try {
      await AxiosInstance.post('users/deactivate/');
      alert('회원탈퇴 완료');
      localStorage.removeItem('Token');
      navigate('/home');
    } catch (err) {
      console.error('Error deactivating account:', err);
      setError('회원탈퇴 실패');
    }
  };

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

  if (loading) {
    return (
      <div className="mp-page">
        <style>{styles}</style>
        <div className="mp-state">
          <span className="mp-spinner" />
          불러오는 중…
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mp-page">
        <style>{styles}</style>
        <div className="mp-state mp-state--error">{error}</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mp-page">
        <style>{styles}</style>
        <div className="mp-state">사용자 데이터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const initial = (user.nickname || user.username || user.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  const fields = [
    { label: '사용자 이름', value: user.username },
    { label: '이메일', value: user.email },
    { label: '닉네임', value: user.nickname },
    { label: '생년월일', value: user.birthday },
    { label: '주소', value: user.address },
    { label: '전화번호', value: user.phone_number },
  ];

  return (
    <div className="mp-page">
      <style>{styles}</style>

      <div className="mp-card">
        {/* 좌측 패널 */}
        <aside className="mp-aside">
          <div className="mp-aside-glow" aria-hidden />
          <div className="mp-aside-inner">
            <div className="mp-avatar">{initial}</div>
            <h1 className="mp-name">{user.nickname || user.username || '마이 페이지'}</h1>
            <p className="mp-mail">{user.email}</p>

            <div className="mp-exam">
              <label className="mp-exam-label" htmlFor="exam-select">
                공부 중인 기술사 <span className="mp-exam-count">{selectedExams.length}</span>
              </label>
              <div className="mp-select-wrap">
                <select
                  id="exam-select"
                  className="mp-select"
                  value=""
                  onChange={handleExamAdd}
                >
                  <option value="">+ 종목 추가</option>
                  {FIELDS.map((group) => (
                    <optgroup key={group.field} label={group.field}>
                      {group.items.map((item) => (
                        <option
                          key={item}
                          value={item}
                          disabled={selectedExams.includes(item)}
                        >
                          {item}기술사
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="mp-select-arrow" aria-hidden>▾</span>
              </div>
              {selectedExams.length > 0 && (
                <div className="mp-chips">
                  {selectedExams.map((item) => (
                    <span className="mp-chip" key={item}>
                      {item}기술사
                      <button
                        type="button"
                        className="mp-chip-x"
                        onClick={() => handleExamRemove(item)}
                        aria-label={`${item}기술사 제거`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 우측 패널 */}
        <section className="mp-main">
          <header className="mp-main-head">
            <h2 className="mp-main-title">{isEditing ? '프로필 수정' : '내 정보'}</h2>
            {!isEditing && (
              <button className="mp-btn mp-btn--soft" onClick={() => setIsEditing(true)}>
                수정
              </button>
            )}
          </header>

          {!isEditing ? (
            <>
              <dl className="mp-info">
                {fields.map((f) => (
                  <div className="mp-info-row" key={f.label}>
                    <dt className="mp-info-label">{f.label}</dt>
                    <dd className="mp-info-value">
                      {f.value || <span className="mp-empty">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mp-actions">
                <button className="mp-btn mp-btn--danger" onClick={handleDeactivate}>
                  회원탈퇴
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="mp-form">
              <div className="mp-grid">
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="username">사용자 이름</label>
                  <input className="mp-input" id="username" name="username"
                    value={formData.username} onChange={handleChange} required />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="nickname">닉네임</label>
                  <input className="mp-input" id="nickname" name="nickname"
                    value={formData.nickname} onChange={handleChange} required />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="email">이메일</label>
                  <input className="mp-input" id="email" name="email" type="email"
                    value={formData.email} onChange={handleChange} required />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="birthday">생년월일</label>
                  <input className="mp-input" id="birthday" name="birthday" type="date"
                    value={formData.birthday} onChange={handleChange} required />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="address">주소</label>
                  <input className="mp-input" id="address" name="address"
                    value={formData.address} onChange={handleChange} />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label" htmlFor="phone_number">전화번호</label>
                  <input className="mp-input" id="phone_number" name="phone_number"
                    value={formData.phone_number} onChange={handleChange} />
                </div>
              </div>
              <div className="mp-actions mp-actions--end">
                <button type="button" className="mp-btn mp-btn--ghost" onClick={handleCancel}>
                  취소
                </button>
                <button type="submit" className="mp-btn mp-btn--primary">
                  업데이트
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

const styles = `
  .mp-page {
    --mp-ink: #2b2d42;
    --mp-muted: #7c7f97;
    --mp-line: #e9e7f1;
    --mp-accent: #7c6ea8;
    --mp-accent-deep: #5d5288;
    --mp-danger: #b05b6b;
    box-sizing: border-box;
    height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 24px;
    background:
      radial-gradient(1100px 520px at 12% -10%, #e7e3f4 0%, rgba(231,227,244,0) 60%),
      radial-gradient(900px 500px at 110% 120%, #e2ecec 0%, rgba(226,236,236,0) 55%),
      linear-gradient(135deg, #f6f5fb 0%, #eef0f6 100%);
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--mp-ink);
  }
  .mp-page *, .mp-page *::before, .mp-page *::after { box-sizing: border-box; }

  .mp-card {
    width: 100%;
    max-width: 880px;
    max-height: calc(100vh - 48px);
    display: grid;
    grid-template-columns: 300px 1fr;
    background: rgba(255,255,255,.82);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,.6);
    border-radius: 26px;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(40,33,77,.06),
      0 24px 60px rgba(60,50,110,.16);
  }

  /* 좌측 */
  .mp-aside {
    position: relative;
    padding: 38px 26px;
    color: #fff;
    background: linear-gradient(160deg, #6b6196 0%, #5d5288 48%, #4f6c79 100%);
    overflow: hidden;
  }
  .mp-aside-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(220px 220px at 80% 8%, rgba(255,255,255,.28), transparent 70%),
      radial-gradient(260px 260px at 5% 100%, rgba(146,196,200,.45), transparent 65%);
    pointer-events: none;
  }
  .mp-aside-inner { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .mp-avatar {
    width: 84px; height: 84px;
    border-radius: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; font-weight: 700; color: #4a4170;
    background: linear-gradient(145deg, #ffffff, #ece8f6);
    box-shadow: 0 10px 26px rgba(30,22,60,.35), inset 0 1px 2px rgba(255,255,255,.9);
  }
  .mp-name { margin: 18px 0 4px; font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
  .mp-mail { margin: 0; font-size: 13px; color: rgba(255,255,255,.78); word-break: break-all; }

  .mp-exam { width: 100%; margin-top: 30px; }
  .mp-exam-label {
    display: block; font-size: 11px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(255,255,255,.72); margin-bottom: 8px;
  }
  .mp-select-wrap { position: relative; }
  .mp-select {
    width: 100%; appearance: none; -webkit-appearance: none;
    padding: 12px 38px 12px 14px;
    font-size: 14px; color: var(--mp-ink);
    background: rgba(255,255,255,.95);
    border: 1px solid rgba(255,255,255,.5); border-radius: 13px;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(30,22,60,.18);
    transition: box-shadow .15s, transform .05s;
  }
  .mp-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.45); }
  .mp-select-arrow {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    pointer-events: none; color: var(--mp-accent); font-size: 13px;
  }
  .mp-exam-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px; margin-left: 4px;
    font-size: 11px; font-weight: 700; color: #fff;
    background: rgba(255,255,255,.22); border-radius: 9px;
    vertical-align: middle;
  }
  .mp-chips {
    margin-top: 12px; display: flex; flex-wrap: wrap; gap: 7px;
    max-height: 132px; overflow-y: auto;
  }
  .mp-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 8px 6px 11px;
    font-size: 12.5px; font-weight: 600; color: #fff;
    background: rgba(255,255,255,.16);
    border: 1px solid rgba(255,255,255,.28);
    border-radius: 999px; backdrop-filter: blur(4px);
  }
  .mp-chip-x {
    display: flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; padding: 0;
    font-size: 14px; line-height: 1; color: #fff; cursor: pointer;
    background: rgba(255,255,255,.18); border: none; border-radius: 50%;
    transition: background .15s;
  }
  .mp-chip-x:hover { background: rgba(255,255,255,.4); }

  /* 우측 */
  .mp-main {
    padding: 34px 36px;
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .mp-main-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
  }
  .mp-main-title { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.01em; }

  .mp-info { margin: 0; overflow-y: auto; padding-right: 4px; }
  .mp-info-row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 13px 2px; border-bottom: 1px solid var(--mp-line);
  }
  .mp-info-row:last-child { border-bottom: none; }
  .mp-info-label { font-size: 13px; color: var(--mp-muted); font-weight: 600; flex-shrink: 0; }
  .mp-info-value { font-size: 14.5px; font-weight: 500; text-align: right; word-break: break-all; }
  .mp-empty { color: #c7c4d4; }

  .mp-form { display: flex; flex-direction: column; min-height: 0; }
  .mp-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px;
    overflow-y: auto; padding: 2px 4px 2px 2px;
  }
  .mp-field { display: flex; flex-direction: column; gap: 6px; }
  .mp-field-label { font-size: 12px; font-weight: 600; color: var(--mp-muted); }
  .mp-input {
    padding: 11px 13px; font-size: 14px; color: var(--mp-ink);
    border: 1.5px solid var(--mp-line); border-radius: 12px; background: #fff;
    transition: border-color .15s, box-shadow .15s;
  }
  .mp-input:focus {
    outline: none; border-color: var(--mp-accent);
    box-shadow: 0 0 0 3px rgba(124,110,168,.18);
  }

  .mp-actions { display: flex; gap: 12px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--mp-line); }
  .mp-actions--end { justify-content: flex-end; }
  .mp-btn {
    padding: 10px 20px; font-size: 14px; font-weight: 600;
    border-radius: 12px; border: 1.5px solid transparent; cursor: pointer;
    transition: transform .05s, background .15s, box-shadow .15s, border-color .15s;
  }
  .mp-btn:active { transform: translateY(1px); }
  .mp-btn--primary {
    background: linear-gradient(135deg, var(--mp-accent), var(--mp-accent-deep));
    color: #fff; box-shadow: 0 8px 20px rgba(93,82,136,.32);
  }
  .mp-btn--primary:hover { filter: brightness(1.06); }
  .mp-btn--soft { background: #f1eef8; color: var(--mp-accent-deep); }
  .mp-btn--soft:hover { background: #e9e4f5; }
  .mp-btn--danger { background: #fff; color: var(--mp-danger); border-color: #eccdd4; }
  .mp-btn--danger:hover { background: #fdf3f5; }
  .mp-btn--ghost { background: #fff; color: var(--mp-muted); border-color: var(--mp-line); }
  .mp-btn--ghost:hover { background: #f8f7fc; }

  .mp-state {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 40px; color: var(--mp-muted); font-size: 15px;
    background: rgba(255,255,255,.82); border-radius: 22px;
    box-shadow: 0 24px 60px rgba(60,50,110,.16);
  }
  .mp-state--error { color: var(--mp-danger); }
  .mp-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2.5px solid #ddd8ea; border-top-color: var(--mp-accent);
    animation: mp-spin .7s linear infinite;
  }
  @keyframes mp-spin { to { transform: rotate(360deg); } }

  @media (max-width: 720px) {
    .mp-page { overflow-y: auto; height: auto; min-height: 100vh; align-items: flex-start; }
    .mp-card { grid-template-columns: 1fr; max-height: none; }
    .mp-grid { grid-template-columns: 1fr; }
  }
`;

export default Mypage;
