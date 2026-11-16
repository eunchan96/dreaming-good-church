'use client';
import { useSyncExternalStore } from 'react';

/**
 * Remembers (per browser tab session) that an editor was signed in, so moving between admin pages
 * keeps the menu visible and shows a loading view instead of the login screen while the session is checked.
 * Only a display hint: every page still verifies the session and membership before showing data.
 */
const KEY = 'church-admin-signed-in';
const listeners = new Set<() => void>();
const read = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
function write(value: boolean) { try { if (value) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } listeners.forEach(listener => listener()); }
export const rememberSignedIn = () => { if (!read()) write(true); };
export const forgetSignedIn = () => { if (read()) write(false); };
export function useRememberedSignIn() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, read, () => false);
}
