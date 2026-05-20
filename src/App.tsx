import { useState } from 'react';
import './pages/AddProduct.css';
import { type AdminCreds, clearStoredCreds, readStoredCreds } from './lib/auth';
import SignIn from './components/SignIn';
import Products from './pages/Products';
import Categories from './pages/Categories';

type Tab = 'products' | 'categories';

function App() {
  const [creds, setCreds] = useState<AdminCreds | null>(() => readStoredCreds());
  const [tab, setTab] = useState<Tab>('products');

  function handleSignOut() {
    clearStoredCreds();
    setCreds(null);
  }

  if (!creds) {
    return <SignIn onSignedIn={setCreds} />;
  }

  return (
    <div className="add-product">
      <header className="admin-header">
        <h1>Norne Craft Admin</h1>
        <p>Manage products and categories</p>
      </header>

      <nav className="admin-tabs">
        <div className="container admin-tabs-inner">
          <div className="admin-tabs-buttons">
            <button
              type="button"
              className={`admin-tab ${tab === 'products' ? 'is-active' : ''}`}
              onClick={() => setTab('products')}
            >
              Products
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'categories' ? 'is-active' : ''}`}
              onClick={() => setTab('categories')}
            >
              Categories
            </button>
          </div>
          <div className="admin-tabs-user">
            Signed in as <strong>{creds.username}</strong>
            <button
              type="button"
              className="add-product-signout"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <section className="add-product-section">
        <div className="container">
          {tab === 'products' ? (
            <Products creds={creds} onSignedOut={handleSignOut} />
          ) : (
            <Categories creds={creds} onSignedOut={handleSignOut} />
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
