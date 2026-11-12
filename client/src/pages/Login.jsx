import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorBox } from '../components/ui.jsx';

const DEMO = [
  ['Farmer', 'farmer1@harvestloop.test'],
  ['Buyer', 'buyer1@harvestloop.test'],
  ['Transporter', 'transporter1@harvestloop.test'],
  ['Admin', 'admin@harvestloop.test'],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto' }}>
      <div className="card">
        <h2>Log in</h2>
        <ErrorBox error={error} />
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>

      <div className="card flat" style={{ marginTop: '1rem' }}>
        <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Demo accounts (password: password123)</div>
        <div className="row">
          {DEMO.map(([label, em]) => (
            <button
              key={em}
              type="button"
              className="btn secondary sm"
              onClick={() => {
                setEmail(em);
                setPassword('password123');
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
