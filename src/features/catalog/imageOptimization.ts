// Image optimization utilities for better loading performance

export function getOptimizedImageUrl(url: string | null | undefined, width?: number): string {
  if (!url) return '';
  
  // If the URL is already a data URI or blob, return as-is
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  // For Supabase Storage URLs, we could add transformation parameters
  // For now, return the original URL but add loading hints
  return url;
}

export function getImageSrcSet(url: string | null | undefined): string {
  if (!url) return '';
  
  // Generate srcset for responsive images
  // This helps browsers load appropriately sized images
  const optimized = getOptimizedImageUrl(url);
  
  // For now, return the base URL
  // In production, you'd generate multiple sizes:
  // `${optimized}?w=400 400w, ${optimized}?w=800 800w, ${optimized}?w=1200 1200w`
  return optimized;
}

export function getImageLoadingStrategy(priority: boolean): 'eager' | 'lazy' {
  return priority ? 'eager' : 'lazy';
}

export function getImageDecoding(priority: boolean): 'sync' | 'async' | 'auto' {
  return priority ? 'auto' : 'async';
}

export function getImageFetchPriority(priority: boolean): 'high' | 'low' | 'auto' {
  return priority ? 'high' : 'low';
}
