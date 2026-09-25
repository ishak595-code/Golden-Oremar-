import React, { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { parseVideoSource, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from './videoSource';

type Props = {
  url: string | null | undefined;
  /** Used for accessible labels, e.g. the product name. */
  title: string;
  /**
   * Show an "open in YouTube" link under the player. Off by default, and must
   * stay off in product safety content: the product workflow contract forbids
   * that panel from sending people to an external website from inside the
   * app. The embed itself plays inside the app, so it is unaffected.
   */
  allowExternalLink?: boolean;
};

/**
 * Plays a product or content video from either a YouTube link or a direct
 * file, without costing anything until the viewer asks for it.
 *
 * YouTube uses a click-to-load facade: only a thumbnail from YouTube's image
 * CDN is shown until play is pressed. Loading the real embed on page view
 * would pull roughly a megabyte of player scripts for every visitor, most of
 * whom never press play, and would let YouTube set storage and track the
 * visit. The facade keeps the page fast and keeps the app honest to its cookie
 * policy, which states that nothing tracks a visitor who has not interacted.
 *
 * The embed is served from youtube-nocookie.com. It sends a referrer with
 * strict-origin-when-cross-origin, because YouTube now refuses to play embeds
 * that arrive with no referrer. An "open in YouTube" fallback link exists for
 * WebViews that cannot play embeds, but only where allowExternalLink permits
 * it.
 *
 * A file video uses preload="none", so nothing is downloaded before play.
 */
export default function ProductVideo({ url, title, allowExternalLink = false }: Props) {
  const source = parseVideoSource(url);
  const [playing, setPlaying] = useState(false);
  if (!source) return null;

  if (source.kind === 'file') {
    return (
      <video
        controls
        playsInline
        preload="none"
        className="aspect-video w-full rounded-2xl bg-black"
        src={source.url}
        aria-label={`${title} videosu`}
      >
        Tarayıcınız bu videoyu oynatamıyor.
      </video>
    );
  }

  const frame = source.vertical
    ? 'mx-auto aspect-[9/16] w-full max-w-xs'
    : 'aspect-video w-full';

  return (
    <div>
      <div className={`${frame} relative overflow-hidden rounded-2xl bg-black`}>
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={youtubeEmbedUrl(source.id)}
            title={`${title} videosu`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${title} videosunu oynat`}
            className="group absolute inset-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold"
          >
            <img
              src={youtubeThumbnailUrl(source.id)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white shadow-xl ring-2 ring-white/80">
              <Play className="ml-1 h-7 w-7" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      {allowExternalLink && <a
        href={youtubeWatchUrl(source)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-brand-green underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-brand-gold"
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
        YouTube'da aç
      </a>}
    </div>
  );
}
