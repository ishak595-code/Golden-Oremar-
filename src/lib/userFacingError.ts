/**
 * The one place that turns any thrown value into a sentence a customer can
 * read.
 *
 * Screens used to show `error.message` directly. That works for the Turkish
 * messages our own code throws, but everything else leaked through as it was:
 * a dropped connection showed "Failed to fetch", an exhausted Supabase quota
 * showed an English restriction notice, and database guards showed codes like
 * "active_profile_required" or "permission_required:product.update".
 *
 * Rules, in order:
 *   1. known situations (no network, quota, session, permission, rate limit,
 *      common sign-in messages) get a fixed Turkish sentence;
 *   2. anything that looks machine-made (snake_case codes, SQL/HTTP/English
 *      library text) gets the caller's fallback;
 *   3. anything else is one of our own Turkish messages and is shown as is.
 *
 * No imports and no DOM access, so the contract audit can execute it.
 */

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|net::|the internet connection appears to be offline|timed? ?out|timeout|aborterror|the operation was aborted/i;
const QUOTA = /\b402\b|payment required|exceed(ed)? (the )?(usage|quota)|project (is )?(paused|restricted)|service for this project is restricted|quota/i;
const SESSION = /authentication_required|jwt expired|invalid jwt|refresh token|auth session missing|session_not_found|not authenticated/i;
const PERMISSION = /permission_required|permission denied|not authorized|unauthorized|forbidden|42501|row-level security/i;
const RATE = /rate.?limit|too many requests|\b429\b|for security purposes, you can only request this/i;

const EXACT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-posta veya şifre hatalı.'],
  [/email not confirmed/i, 'E-posta adresinizi doğruladıktan sonra giriş yapabilirsiniz.'],
  [/user already registered|already been registered/i, 'Bu e-posta ile daha önce hesap oluşturulmuş.'],
  [/password should be at least|weak password|password is too weak/i, 'Şifre yeterince güçlü değil.'],
  [/new password should be different/i, 'Yeni şifre eskisinden farklı olmalı.'],
  [/email address .* is invalid|invalid email|unable to validate email/i, 'Geçerli bir e-posta adresi girin.'],
  [/signups? not allowed|signup is disabled/i, 'Şu anda yeni hesap açılamıyor. Lütfen daha sonra tekrar deneyin.'],
  [/active_profile_required|profile_blocked|account_blocked|account_suspended/i, 'Hesabınız şu anda bu işlem için etkin değil. Destek ile iletişime geçebilirsiniz.'],
];

export const USER_FACING = {
  network: 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
  quota: 'Hizmet şu anda geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.',
  session: 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.',
  permission: 'Bu işlem için yetkiniz yok.',
  rate: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
} as const;

const DEFAULT_FALLBACK = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const ENGLISH_WORDS = /\b(the|is|was|not|to|for|with|and|of|could|cannot|can't|failed|error|invalid|request|response|unexpected|undefined|null|object|function|relation|column|violates|duplicate|syntax|constraint|returned|rows?)\b/i;

function rawMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.error_description, record.error, record.details, record.code]
      .filter(part => typeof part === 'string' && part.trim()) as string[];
    if (parts.length) return parts.join(' ');
    if (typeof record.status === 'number') return `HTTP ${record.status}`;
  }
  return '';
}

/**
 * The raw text of an error, for code comparisons such as
 * `errorText(e).includes('insufficient_stock')`. Never show it to a person.
 */
export function errorText(error: unknown): string {
  return rawMessage(error);
}

/** True when a message was produced by a machine, not written for a person. */
export function looksMachineMade(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (/^[a-z0-9_.:\-/ ]+$/.test(text) && /[_:]/.test(text)) return true; // codes like permission_required:product.update
  if (/^[A-Z]{2,}[A-Z0-9_]*$/.test(text)) return true; // PGRST116, P0001
  if (/\b(pgrst\d+|sqlstate|p0001|\d{5})\b/i.test(text) && !TURKISH_LETTERS.test(text)) return true;
  if (!TURKISH_LETTERS.test(text) && ENGLISH_WORDS.test(text)) return true;
  if (/[{}<>]|\bat\s+\S+:\d+/.test(text)) return true; // JSON, HTML, stack frames
  return false;
}

export function userFacingError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  const message = rawMessage(error).trim();
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined;
  if (status === 402 || QUOTA.test(message)) return USER_FACING.quota;
  if (NETWORK.test(message) || (typeof navigator !== 'undefined' && navigator && navigator.onLine === false)) return USER_FACING.network;
  for (const [pattern, sentence] of EXACT) if (pattern.test(message)) return sentence;
  if (status === 429 || RATE.test(message)) return USER_FACING.rate;
  if (status === 401 || SESSION.test(message)) return USER_FACING.session;
  if (status === 403 || PERMISSION.test(message)) return USER_FACING.permission;
  if (looksMachineMade(message)) return fallback;
  return message.length > 400 ? fallback : message;
}
