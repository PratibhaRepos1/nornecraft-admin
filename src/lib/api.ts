export const API_BASE = 'https://nornecraft-api.vercel.app';

export const PRODUCTS_URL = `${API_BASE}/api/products`;
export const CATEGORIES_URL = `${API_BASE}/api/categories`;
export const VERIFY_URL = `${API_BASE}/api/verify`;
export const UPLOAD_URL = `${API_BASE}/api/upload`;

export const IMAGE_BASE_URL = 'https://nornecraft.com/products/';

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png'];
export const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png'];

export function buildImageUrl(imageInput: string): string {
  const trimmed = imageInput.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return IMAGE_BASE_URL + trimmed.replace(/^\/+/, '');
}

export interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  category_id?: number;
  price: number;
  stock: number;
  rating: number;
  image: string;
  description: string;
}
