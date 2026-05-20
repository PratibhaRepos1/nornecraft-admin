import { useState } from 'react';
import { type AdminCreds, persistCreds, verifyCreds } from '../lib/auth';

interface SignInProps {
  onSignedIn: (creds: AdminCreds) => void;
}

function SignIn({ onSignedIn }: SignInProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = usernameInput.trim();
    const p = passwordInput;
    if (!u || !p) return;

    setSigningIn(true);
    setSignInError(null);
    try {
      const { ok, status } = await verifyCreds({ username: u, password: p });
      if (status === 401) {
        setSignInError('Invalid username or password.');
        return;
      }
      if (!ok) {
        setSignInError(`Sign-in failed (${status}). Try again.`);
        return;
      }
      const creds: AdminCreds = { username: u, password: p };
      persistCreds(creds);
      onSignedIn(creds);
      setUsernameInput('');
      setPasswordInput('');
    } catch {
      setSignInError('Could not reach the server. Check your connection.');
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="add-product">
      <header className="admin-header">
        <h1>Norne Craft Admin</h1>
        <p>Sign in to manage products</p>
      </header>
      <section className="add-product-section">
        <div className="container">
          <div className="add-product-wrapper">
            <p className="add-product-intro">
              Sign in with your admin username and password to manage products and categories.
            </p>
            <form onSubmit={handleUnlockSubmit} className="add-product-form">
              <div className="form-group">
                <label htmlFor="adminUsername">Username</label>
                <input
                  type="text"
                  id="adminUsername"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminPassword">Password</label>
                <input
                  type="password"
                  id="adminPassword"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Your admin password"
                  autoComplete="current-password"
                  required
                />
                <small className="form-hint">
                  Stored in this browser only and sent as an HTTP Basic Auth header on each save.
                </small>
              </div>
              {signInError && (
                <div className="add-product-message error">{signInError}</div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={signingIn || !usernameInput.trim() || !passwordInput}
              >
                {signingIn ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SignIn;
