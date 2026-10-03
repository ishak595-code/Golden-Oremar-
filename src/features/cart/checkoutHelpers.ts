/**
 * Small pure helpers for the cart and checkout screens, kept apart so the
 * rules (identity checks, country names, shipping messages) can be tested
 * without rendering anything.
 */

/** Every ISO 3166-1 alpha-2 country, shown with its Turkish name. */
const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ ' +
  'OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

let countryOptionsCache: Array<{ code: string; name: string }> | null = null;

/** Türkiye first, then every other country alphabetically by its Turkish name. */
export function countryOptions() {
  if (countryOptionsCache) return countryOptionsCache;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(['tr'], { type: 'region' }); } catch { names = null; }
  const all = COUNTRY_CODES.map(code => ({ code, name: (names?.of(code) || code).trim() }));
  const tr = all.find(option => option.code === 'TR')!;
  countryOptionsCache = [tr, ...all.filter(option => option.code !== 'TR').sort((a, b) => a.name.localeCompare(b.name, 'tr'))];
  return countryOptionsCache;
}

export function isKnownCountry(code: string) {
  return COUNTRY_CODES.includes(code);
}

/**
 * T.C. kimlik numarası check: 11 digits, no leading zero, and the two check
 * digits defined by the Population Directorate. Catching a typo here saves
 * the customer a rejected payment.
 */
export function isValidTurkishIdentity(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = ((odd * 7 - even) % 10 + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

export type ShippingInsight = {
  free: boolean;
  remainingForFreeMinor: number | null;
  progress: number | null;
  deliveryText: string | null;
  note: string | null;
};

/** What the cart says about shipping, from the server's quote. */
export function shippingInsight(shipping: Record<string, any> | null | undefined, subtotalMinor: number): ShippingInsight | null {
  if (!shipping || shipping.available !== true) return null;
  const fee = Number(shipping.shippingMinor);
  const threshold = Number(shipping.freeShippingThresholdMinor);
  const hasThreshold = Number.isSafeInteger(threshold) && threshold > 0;
  const remaining = hasThreshold && subtotalMinor < threshold ? threshold - subtotalMinor : null;
  const min = Number(shipping.minDeliveryDays), max = Number(shipping.maxDeliveryDays);
  let deliveryText: string | null = null;
  if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && min > 0 && max >= min) deliveryText = min === max ? `${min} iş günü içinde teslimat` : `${min}-${max} iş günü içinde teslimat`;
  else if (Number.isSafeInteger(max) && max > 0) deliveryText = `En geç ${max} iş günü içinde teslimat`;
  return {
    free: Number.isSafeInteger(fee) && fee === 0,
    remainingForFreeMinor: remaining,
    progress: hasThreshold ? Math.max(0, Math.min(1, subtotalMinor / threshold)) : null,
    deliveryText,
    note: typeof shipping.publicNote === 'string' && shipping.publicNote.trim() && !/yönetim panel|tarifeleri bağlandığında/i.test(shipping.publicNote) ? shipping.publicNote.trim().slice(0, 240) : null,
  };
}

export function formatMoney(minor: number, currency: string) {
  // Turkish lira the way the product page and cards write it: "820 TL",
  // "12,50 TL" (kuruş only when there are some).
  if (String(currency).toUpperCase() === 'TRY' && Number.isFinite(minor)) {
    const digits = Math.round(minor) % 100 === 0 ? 0 : 2;
    return `${(minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} TL`;
  }
  try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100); }
  catch { return `${(minor / 100).toLocaleString('tr-TR')} ${currency}`; }
}
