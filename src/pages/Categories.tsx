import { useEffect, useState } from 'react';
import { type AdminCreds, authedFetch, clearStoredCreds } from '../lib/auth';
import { CATEGORIES_URL, type Category } from '../lib/api';
import type { ToastKind } from '../components/Toast';

interface CategoriesProps {
  creds: AdminCreds;
  onSignedOut: () => void;
  showToast: (text: string, kind: ToastKind) => void;
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
}

const emptyForm: CategoryForm = { name: '', slug: '', description: '' };

const PAGE_SIZE = 5;

function Categories({ creds, onSignedOut, showToast }: CategoriesProps) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadCategories() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(CATEGORIES_URL);
      if (!res.ok) throw new Error(`Failed to load categories (${res.status})`);
      const data = (await res.json()) as Category[] | { categories?: Category[] };
      const list = Array.isArray(data) ? data : data.categories ?? [];
      setItems(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, items.length);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({
      name: cat.name ?? '',
      slug: cat.slug ?? '',
      description: cat.description ?? '',
    });
  }

  function handleAuthError(status: number, fallback: string): string {
    if (status === 403 || status === 401) {
      clearStoredCreds();
      onSignedOut();
      return 'Session expired — please sign in again.';
    }
    return fallback;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const body = JSON.stringify({
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
    });

    const url = editingId == null ? CATEGORIES_URL : `${CATEGORIES_URL}/${editingId}`;
    const method = editingId == null ? 'POST' : 'PUT';
    const wasEditing = editingId != null;

    try {
      const res = await authedFetch(creds, url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json().catch(() => ({} as { error?: string }));

      if (!res.ok) {
        throw new Error(handleAuthError(res.status, data.error || 'Failed to save category'));
      }

      showToast(wasEditing ? 'Category updated.' : 'Category added.', 'success');
      resetForm();
      await loadCategories();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save category',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!window.confirm(`Delete category "${cat.name}"? Products in this category may be affected.`)) {
      return;
    }
    try {
      const res = await authedFetch(creds, `${CATEGORIES_URL}/${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(handleAuthError(res.status, data.error || 'Failed to delete category'));
      }
      showToast(`Category "${cat.name}" deleted.`, 'success');
      if (editingId === cat.id) resetForm();
      await loadCategories();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete category',
        'error',
      );
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h2 className="admin-card-title">
          {editingId == null ? 'Add Category' : 'Edit Category'}
        </h2>

        <form onSubmit={handleSubmit} className="add-product-form">
          <div className="form-group">
            <label htmlFor="cat-name">Name</label>
            <input
              type="text"
              id="cat-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Drinking Horns"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat-slug">Slug</label>
            <input
              type="text"
              id="cat-slug"
              name="slug"
              value={form.slug}
              onChange={handleChange}
              placeholder="e.g. drinking-horns"
            />
            <small className="form-hint">URL-friendly identifier (optional).</small>
          </div>

          <div className="form-group">
            <label htmlFor="cat-description">Description</label>
            <textarea
              id="cat-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Short category description..."
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? 'Saving...'
                : editingId == null
                ? 'Add Category'
                : 'Save Changes'}
            </button>
            {editingId != null && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">Categories</h2>

        {loading && <p className="form-hint">Loading...</p>}
        {loadError && <div className="add-product-message error">{loadError}</div>}
        {!loading && !loadError && items.length === 0 && (
          <p className="form-hint">No categories yet. Add one above.</p>
        )}

        {items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((cat) => (
                  <tr key={cat.id}>
                    <td>{cat.name}</td>
                    <td>{cat.slug || '—'}</td>
                    <td className="td-truncate">{cat.description || '—'}</td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => startEdit(cat)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-btn link-btn-danger"
                        onClick={() => handleDelete(cat)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="admin-pagination">
              <span className="admin-pagination-info">
                Showing {rangeStart}–{rangeEnd} of {items.length}
              </span>
              <div className="admin-pagination-controls">
                <button
                  type="button"
                  className="admin-pagination-btn"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                >
                  Previous
                </button>
                <span className="admin-pagination-page">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="admin-pagination-btn"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;
