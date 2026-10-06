// Supabase client. Browser code may ONLY use the project URL + publishable (anon) key.
// Security is enforced by Row Level Security in the database (see supabase/migrations).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Refuse privileged keys: a service-role / secret key must never be shipped to a browser.
function isPrivilegedKey(k) {
  if (/^sb_secret_/.test(k)) return true;
  try {
    const payload = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch { return false; }
}

let configured = Boolean(url && key && /^https?:\/\//.test(url));
if (configured && isPrivilegedKey(key)) {
  console.error('[KDS] A secret/service-role key was supplied. Use the PUBLISHABLE key only. Supabase disabled.');
  configured = false;
}

export const isConfigured = configured;
export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
