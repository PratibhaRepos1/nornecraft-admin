import { useState } from 'react';
import './AddProduct.css';

const ADMIN_CREDS_KEY = 'nornecraft-admin-creds';

interface AdminCreds {
  username: string;
  password: string;
}

const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://api.nornecraft.com';

const PRODUCTS_URL = `${API_BASE}/api/products`;
const VERIFY_URL = `${API_BASE}/api/verify`;

const IMAGE_BASE_URL = 'https://nornecraft.com/products/';

function buildImageUrl(imageInput: string): string {
  const trimmed = imageInput.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return IMAGE_BASE_URL + trimmed.replace(/^\/+/, '');
}

const initialForm = {
  name: '',
  category: '',
  price: '',
  stock: '',
  rating: '',
  image: '',
  description: '',
};

type FormState = typeof initialForm;

function readStoredCreds(): AdminCreds | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminCreds>;
    if (!parsed.username || !parsed.password) return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

function AddProduct() {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(() => readStoredCreds());
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  function persistCreds(creds: AdminCreds) {
    try {
      window.localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(creds));
    } catch {
      /* ignore storage errors */
    }
    setAdminCreds(creds);
  }

  function clearCreds() {
    try {
      window.localStorage.removeItem(ADMIN_CREDS_KEY);
    } catch {
      /* ignore storage errors */
    }
    setAdminCreds(null);
  }

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = usernameInput.trim();
    const p = passwordInput;
    if (!u || !p) return;

    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await fetch(VERIFY_URL, {
        method: 'GET',
        headers: { Authorization: `Basic ${btoa(`${u}:${p}`)}` },
      });

      if (res.status === 401) {
        setSignInError('Invalid username or password.');
        return;
      }
      if (!res.ok) {
        setSignInError(`Sign-in failed (${res.status}). Try again.`);
        return;
      }

      persistCreds({ username: u, password: p });
      setUsernameInput('');
      setPasswordInput('');
    } catch {
      setSignInError('Could not reach the server. Check your connection.');
    } finally {
      setSigningIn(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminCreds) {
        const basic = btoa(`${adminCreds.username}:${adminCreds.password}`);
        headers['Authorization'] = `Basic ${basic}`;
      }

      const res = await fetch(PRODUCTS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: formData.name.trim(),
          category: formData.category.trim(),
          price: Number(formData.price),
          stock: formData.stock === '' ? 0 : Number(formData.stock),
          rating: formData.rating === '' ? 0 : Number(formData.rating),
          image: buildImageUrl(formData.image),
          description: formData.description.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        clearCreds();
        throw new Error(
          data.error || 'Forbidden — your username or password may have changed. Please sign in again.'
        );
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add product');
      }

      setMessage({ kind: 'success', text: `Product "${data.name}" added successfully.` });
      setFormData(initialForm);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to add product';
      setMessage({ kind: 'error', text });
    } finally {
      setSubmitting(false);
    }
  }

  if (!adminCreds) {
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
                Sign in with your admin username and password to add products.
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

  return (
    <div className="add-product">
      <header className="admin-header">
        <h1>Norne Craft Admin</h1>
        <p>Add a new product</p>
      </header>

      <section className="add-product-section">
        <div className="container">
          <div className="add-product-wrapper">
            <p className="add-product-intro">
              Fill out the details below to add a new product to the shop.
              {' '}
              Signed in as <strong>{adminCreds.username}</strong>.{' '}
              <button
                type="button"
                className="add-product-signout"
                onClick={clearCreds}
              >
                Sign out
              </button>
            </p>

            <form onSubmit={handleSubmit} className="add-product-form">
              <div className="form-group">
                <label htmlFor="name">Product Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Viking Drinking Horn"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    placeholder="e.g. Drinking Horns"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="price">Price (USD)</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="49.99"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stock">Stock</label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    placeholder="25"
                    min="0"
                    step="1"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rating">Rating (0-5)</label>
                  <input
                    type="number"
                    id="rating"
                    name="rating"
                    value={formData.rating}
                    onChange={handleChange}
                    placeholder="4.5"
                    min="0"
                    max="5"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Image Name</label>
                <input
                  type="text"
                  id="image"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  placeholder="horn_mug.jpeg"
                />
                <small className="form-hint">
                  Upload the image to <code>/public_html/products/</code> on Hostinger, then enter
                  just the filename here (e.g. <code>horn_mug.jpeg</code>). It will be saved as{' '}
                  <code>{IMAGE_BASE_URL}&lt;filename&gt;</code>.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Short product description..."
                  rows={4}
                />
              </div>

              {message && (
                <div className={`add-product-message ${message.kind}`}>{message.text}</div>
              )}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add Product'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AddProduct;
