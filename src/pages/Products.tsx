import { useEffect, useRef, useState } from 'react';
import { type AdminCreds, authedFetch, clearStoredCreds } from '../lib/auth';
import {
  ALLOWED_IMAGE_EXT,
  ALLOWED_IMAGE_MIME,
  CATEGORIES_URL,
  type Category,
  IMAGE_BASE_URL,
  PRODUCTS_URL,
  type Product,
  UPLOAD_URL,
  buildImageUrl,
} from '../lib/api';

interface ProductsProps {
  creds: AdminCreds;
  onSignedOut: () => void;
}

interface ProductForm {
  name: string;
  category: string;
  price: string;
  stock: string;
  rating: string;
  image: string;
  description: string;
}

const emptyForm: ProductForm = {
  name: '',
  category: '',
  price: '',
  stock: '',
  rating: '',
  image: '',
  description: '',
};

function Products({ creds, onSignedOut }: ProductsProps) {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviewTs, setImagePreviewTs] = useState<number>(0);
  const [imagePreviewBroken, setImagePreviewBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadProducts() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(PRODUCTS_URL);
      if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
      const data = (await res.json()) as Product[];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch(CATEGORIES_URL);
      if (!res.ok) return;
      const data = (await res.json()) as Category[];
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      /* non-fatal — dropdown will just be empty */
    }
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setFormData(emptyForm);
    setEditingId(null);
    setImageError(null);
    setImagePreviewBroken(false);
    resetFileInput();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setFormData({
      name: p.name ?? '',
      category: p.category ?? '',
      price: p.price == null ? '' : String(p.price),
      stock: p.stock == null ? '' : String(p.stock),
      rating: p.rating == null ? '' : String(p.rating),
      image: deriveImageFilename(p.image ?? ''),
      description: p.description ?? '',
    });
    setMessage(null);
    setImageError(null);
    setImagePreviewBroken(false);
    setImagePreviewTs(Date.now());
    resetFileInput();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function deriveImageFilename(image: string): string {
    if (!image) return '';
    if (image.startsWith(IMAGE_BASE_URL)) return image.slice(IMAGE_BASE_URL.length);
    return image;
  }

  function handleAuthError(status: number, fallback: string): string {
    if (status === 403 || status === 401) {
      clearStoredCreds();
      onSignedOut();
      return 'Session expired — please sign in again.';
    }
    return fallback;
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);

    const lowerName = file.name.toLowerCase();
    const ext = lowerName.slice(lowerName.lastIndexOf('.'));
    const mimeOk = ALLOWED_IMAGE_MIME.includes(file.type.toLowerCase());
    const extOk = ALLOWED_IMAGE_EXT.includes(ext);
    if (!mimeOk && !extOk) {
      setImageError('Only JPEG, JPG, and PNG images are allowed.');
      resetFileInput();
      return;
    }

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);

      const res = await authedFetch(creds, UPLOAD_URL, {
        method: 'POST',
        body: fd,
      });

      const data = await res
        .json()
        .catch(() => ({} as { filename?: string; url?: string; error?: string }));

      if (!res.ok) {
        throw new Error(handleAuthError(res.status, data.error || 'Failed to upload image'));
      }

      const filename =
        data.filename ||
        (typeof data.url === 'string' ? data.url.split('/').pop() : '') ||
        '';

      if (!filename) throw new Error('Upload succeeded but no filename was returned.');

      setFormData((prev) => ({ ...prev, image: filename }));
      setImagePreviewTs(Date.now());
      setImagePreviewBroken(false);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to upload image.');
      resetFileInput();
    } finally {
      setUploadingImage(false);
    }
  }

  function handleClearImage() {
    setFormData((prev) => ({ ...prev, image: '' }));
    setImageError(null);
    setImagePreviewBroken(false);
    resetFileInput();
  }

  function handleRetryPreview() {
    setImagePreviewTs(Date.now());
    setImagePreviewBroken(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload = {
      name: formData.name.trim(),
      category: formData.category.trim(),
      price: Number(formData.price),
      stock: formData.stock === '' ? 0 : Number(formData.stock),
      rating: formData.rating === '' ? 0 : Number(formData.rating),
      image: buildImageUrl(formData.image),
      description: formData.description.trim(),
    };

    const url = editingId == null ? PRODUCTS_URL : `${PRODUCTS_URL}/${editingId}`;
    const method = editingId == null ? 'POST' : 'PUT';

    try {
      const res = await authedFetch(creds, url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as { error?: string; name?: string }));

      if (!res.ok) {
        throw new Error(handleAuthError(res.status, data.error || 'Failed to save product'));
      }

      setMessage({
        kind: 'success',
        text:
          editingId == null
            ? `Product "${data.name ?? payload.name}" added successfully.`
            : `Product "${data.name ?? payload.name}" updated.`,
      });
      resetForm();
      await loadProducts();
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save product',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(`Delete product "${p.name}"?`)) return;
    setMessage(null);
    try {
      const res = await authedFetch(creds, `${PRODUCTS_URL}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(handleAuthError(res.status, data.error || 'Failed to delete product'));
      }
      setMessage({ kind: 'success', text: `Product "${p.name}" deleted.` });
      if (editingId === p.id) resetForm();
      await loadProducts();
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete product',
      });
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h2 className="admin-card-title">
          {editingId == null ? 'Add Product' : 'Edit Product'}
        </h2>

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
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  {categories.length === 0 ? 'No categories — add one first' : 'Select a category'}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                {formData.category &&
                  !categories.some((c) => c.name === formData.category) && (
                    <option value={formData.category}>
                      {formData.category} (current)
                    </option>
                  )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="price">Price (NOK)</label>
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
            <label htmlFor="imageFile">Product Image</label>
            <input
              type="file"
              id="imageFile"
              ref={fileInputRef}
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
            <small className="form-hint">
              Accepted formats: JPEG, JPG, PNG. The file is uploaded to{' '}
              <code>{IMAGE_BASE_URL}</code> and the filename is saved with the product.
            </small>
            {uploadingImage && <small className="form-hint">Uploading image...</small>}
            {imageError && <div className="add-product-message error">{imageError}</div>}
            {formData.image && !uploadingImage && (
              <div className="image-preview">
                {!imagePreviewBroken ? (
                  <img
                    src={`${buildImageUrl(formData.image)}${imagePreviewTs ? `?t=${imagePreviewTs}` : ''}`}
                    alt="Uploaded preview"
                    className="image-preview-img"
                    onError={() => setImagePreviewBroken(true)}
                    onLoad={() => setImagePreviewBroken(false)}
                  />
                ) : (
                  <div className="image-preview-placeholder">
                    Preview unavailable yet — the file may still be propagating.{' '}
                    <button
                      type="button"
                      className="add-product-signout"
                      onClick={handleRetryPreview}
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div className="image-preview-meta">
                  <small className="form-hint">
                    Saved as{' '}
                    <a
                      href={buildImageUrl(formData.image)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <code>{buildImageUrl(formData.image)}</code>
                    </a>
                  </small>
                  <button
                    type="button"
                    className="add-product-signout"
                    onClick={handleClearImage}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
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

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || uploadingImage}
            >
              {submitting
                ? 'Saving...'
                : editingId == null
                ? 'Add Product'
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
        <h2 className="admin-card-title">Products</h2>

        {loading && <p className="form-hint">Loading...</p>}
        {loadError && <div className="add-product-message error">{loadError}</div>}
        {!loading && !loadError && items.length === 0 && (
          <p className="form-hint">No products yet. Add one above.</p>
        )}

        {items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Rating</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <img
                          src={buildImageUrl(deriveImageFilename(p.image))}
                          alt={p.name}
                          className="admin-thumb"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                          }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td>{p.category || '—'}</td>
                    <td>{Number(p.price).toFixed(2)}</td>
                    <td>{p.stock ?? 0}</td>
                    <td>{p.rating ?? 0}</td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-btn link-btn-danger"
                        onClick={() => handleDelete(p)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Products;
