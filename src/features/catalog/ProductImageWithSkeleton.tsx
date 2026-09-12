import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

type Props = {
  src: string | null | undefined;
  alt: string;
  aspectRatio?: 'square' | '4/3' | '16/9';
  objectFit?: 'cover' | 'contain';
  priority?: boolean;
  fallbackText?: string;
  className?: string;
};

export default function ProductImageWithSkeleton({
  src,
  alt,
  aspectRatio = 'square',
  objectFit = 'cover',
  priority = false,
  fallbackText = 'Ürün görseli yakında',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const aspectClass = aspectRatio === 'square' ? 'aspect-square' : aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-[16/9]';
  const objectClass = objectFit === 'cover' ? 'object-cover' : 'object-contain';

  if (!src || error) {
    return (
      <div className={`${aspectClass} grid place-items-center bg-gray-100 dark:bg-gray-800 ${className}`} role="img" aria-label={fallbackText}>
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <ImageOff aria-hidden="true" className="h-8 w-8 text-brand-muted" />
          <span className="text-sm font-semibold text-brand-muted">{fallbackText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} relative overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" aria-hidden="true" />
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={`h-full w-full ${objectClass} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />
    </div>
  );
}
