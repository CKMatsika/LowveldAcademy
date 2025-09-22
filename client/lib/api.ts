import { load, save } from "./storage";

const TOKEN_KEY = "auth.token";

// Use the backend server running on port 4000
const API_BASE_URL = "http://localhost:4000";

export function getToken(): string | null {
  return load<string | null>(TOKEN_KEY, null);
}

export function setToken(token: string | null) {
  if (token) save(TOKEN_KEY, token);
  else save(TOKEN_KEY, null);
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Log the request for debugging
  console.log('API Request:', API_BASE_URL + path, { headers: { ...headers, Authorization: headers.Authorization ? '[HIDDEN]' : undefined } });

  const res = await fetch(API_BASE_URL + path, { ...opts, headers });

  // Log response status for debugging
  console.log('API Response:', API_BASE_URL + path, res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error('API Error Response:', text);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
