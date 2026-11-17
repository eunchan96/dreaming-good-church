export interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
// Browser memory only: preserve the one-shot event when navigating to /install.
let pending: InstallEvent | null = null;
const listeners = new Set<() => void>();
export function subscribeInstallPrompt(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function serverInstallPrompt() { return null; }
export function rememberInstallPrompt(event: Event) { event.preventDefault(); pending = event as InstallEvent; listeners.forEach(listener => listener()); }
export function getInstallPrompt() { return pending; }
export function clearInstallPrompt() { pending = null; listeners.forEach(listener => listener()); }
