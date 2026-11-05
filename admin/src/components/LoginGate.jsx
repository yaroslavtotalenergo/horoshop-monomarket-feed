import React, { useState } from 'react';
import { hashPassword, STORED_LOGIN, STORED_PASS_HASH } from '../utils/helpers';

export default function LoginGate({ children }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem('panel_auth') === 'ok');
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const passHash = await hashPassword(pass);
    if (login.trim() === STORED_LOGIN && passHash === STORED_PASS_HASH) {
      localStorage.setItem('panel_auth', 'ok');
      setAuthed(true);
    } else {
      setError('Невірний логін або пароль');
    }
    setLoading(false);
  };

  if (authed) return children;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CRM PRO</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Панель керування</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Логін</label>
            <input
              type="text" className="input-field" autoComplete="username"
              value={login} onChange={e => setLogin(e.target.value)}
              placeholder="Введіть логін"
              style={{ fontSize: '1rem' }}
            />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password" className="input-field" autoComplete="current-password"
              value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              style={{ fontSize: '1rem' }}
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
          <button type="submit" className="btn success" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? 'Перевірка...' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
}
