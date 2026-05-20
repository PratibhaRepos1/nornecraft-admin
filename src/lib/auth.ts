import { VERIFY_URL } from './api';

const ADMIN_CREDS_KEY = 'nornecraft-admin-creds';

export interface AdminCreds {
  username: string;
  password: string;
}

export function readStoredCreds(): AdminCreds | null {
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

export function persistCreds(creds: AdminCreds) {
  try {
    window.localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(creds));
  } catch {
    /* ignore */
  }
}

export function clearStoredCreds() {
  try {
    window.localStorage.removeItem(ADMIN_CREDS_KEY);
  } catch {
    /* ignore */
  }
}

export function basicAuthHeader(creds: AdminCreds): string {
  return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
}

export async function verifyCreds(creds: AdminCreds): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(VERIFY_URL, {
    method: 'GET',
    headers: { Authorization: basicAuthHeader(creds) },
  });
  return { ok: res.ok, status: res.status };
}

export async function authedFetch(
  creds: AdminCreds,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: basicAuthHeader(creds),
  };
  return fetch(url, { ...init, headers });
}
