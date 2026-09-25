/**
 * Decide how a product or content video should be played.
 *
 * A YouTube link costs this project nothing to serve: YouTube hosts the file,
 * transcodes it into every quality, streams it adaptively and pays for the
 * bandwidth. A file in Supabase Storage is billed as egress on every play. So
 * YouTube links are recognised and routed to an embedded player, and anything
 * else is treated as a direct video file.
 *
 * No imports and no DOM access, so the contract audit can execute it.
 */

export type VideoSource =
  | { kind: 'youtube'; id: string; vertical: boolean }
  | { kind: 'file'; url: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);

function youtubeId(url: URL): { id: string; vertical: boolean } | null {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const segments = url.pathname.split('/').filter(Boolean);

  let candidate = '';
  let vertical = false;
  if (host === 'youtu.be') {
    candidate = segments[0] || '';
  } else if (segments[0] === 'watch') {
    candidate = url.searchParams.get('v') || '';
  } else if (segments[0] === 'shorts') {
    candidate = segments[1] || '';
    vertical = true;
  } else if (segments[0] === 'embed' || segments[0] === 'live' || segments[0] === 'v') {
    candidate = segments[1] || '';
  }
  return YOUTUBE_ID.test(candidate) ? { id: candidate, vertical } : null;
}

/**
 * Returns null for anything unusable. Only https is accepted, so a stored value
 * can never become a javascript: or data: source.
 */
export function parseVideoSource(raw: unknown): VideoSource | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const youtube = youtubeId(url);
  if (youtube) return { kind: 'youtube', ...youtube };
  // A YouTube-looking host whose id could not be extracted is not treated as
  // a playable file: the <video> element cannot play a YouTube page.
  if (YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  return { kind: 'file', url: url.toString() };
}

/**
 * Turn what an admin pastes into a canonical YouTube link, or null.
 *
 * People paste links in every shape: with or without https://, from the share
 * sheet (youtu.be/...?si=...), from the address bar, as Shorts. Anything that
 * is not recognisably a single YouTube video returns null, so the admin form
 * can refuse it before save instead of letting the server reject it.
 * The result always matches private.is_youtube_video_url_v1 on the server.
 */
export function normalizeYoutubeInput(raw: unknown): string | null {
  let value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.length > 2000) return null;
  if (/^(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(value)) value = `https://${value}`;
  const source = parseVideoSource(value);
  return source?.kind === 'youtube' ? youtubeWatchUrl(source) : null;
}

/** Privacy-enhanced embed. Loaded only after the viewer presses play. */
export function youtubeEmbedUrl(id: string): string {
  const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', modestbranding: '1' });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
}

export function youtubeWatchUrl(source: { id: string; vertical: boolean }): string {
  return source.vertical
    ? `https://www.youtube.com/shorts/${encodeURIComponent(source.id)}`
    : `https://www.youtube.com/watch?v=${encodeURIComponent(source.id)}`;
}

/** Thumbnail served by YouTube's image CDN, which sets no cookies. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}
