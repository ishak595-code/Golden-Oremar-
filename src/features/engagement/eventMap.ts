export function eventMapUrl(locationName: unknown) {
  if (typeof locationName !== 'string') return '';
  const location = locationName.trim();
  if (!location || location.length > 300 || /[\u0000-\u001F\u007F]/.test(location)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
