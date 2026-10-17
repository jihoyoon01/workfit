'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveLogin } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@workfit.dev');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      saveLogin(res.token, res.name);
      router.replace('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card stack" onSubmit={onSubmit}>
        <div>
          <div className="brand" style={{ padding: 0 }}>
            WorkFit<span>관리자</span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0' }}>콘텐츠를 등록하고 관리하려면 관리자 계정으로 로그인하세요.</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        <label className="field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          초기 계정: admin@workfit.dev / admin1234 (seed.sql 기준)
        </p>
      </form>
    </div>
  );
}
