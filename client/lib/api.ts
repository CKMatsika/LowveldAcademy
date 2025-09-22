import { load, save } from "./storage";

const TOKEN_KEY = "auth.token";

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
  console.log('API Request:', path, { headers: { ...headers, Authorization: headers.Authorization ? '[HIDDEN]' : undefined } });

  const res = await fetch(path, { ...opts, headers });

  // Log response status for debugging
  console.log('API Response:', path, res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error('API Error Response:', text);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
