const KEY = 'saleshop_vault_ts';
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function unlockVault() {
  sessionStorage.setItem(KEY, Date.now().toString());
}

export function lockVault() {
  sessionStorage.removeItem(KEY);
}

export function isVaultUnlocked(): boolean {
  const ts = sessionStorage.getItem(KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < TIMEOUT_MS;
}

export function vaultExpiresIn(): number {
  const ts = sessionStorage.getItem(KEY);
  if (!ts) return 0;
  return Math.max(0, TIMEOUT_MS - (Date.now() - parseInt(ts, 10)));
}

export function vaultMinutesLeft(): string {
  const ms = vaultExpiresIn();
  if (!ms) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
