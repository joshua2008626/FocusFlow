import { supabase } from './supabase';
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
/** Authenticated call to the FastAPI backend. Throws Error(message) with the server's detail on failure. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase!.auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail ?? `Request failed (${res.status})`);
  return json as T;
}
