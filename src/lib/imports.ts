export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_BATCH = 10;
export function normalizeTikTokUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Use a full HTTPS TikTok link.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'].includes(
      url.hostname,
    ) ||
    url.pathname === '/'
  )
    throw new Error('Only HTTPS TikTok video or short links are supported.');
  if (
    ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(url.hostname) &&
    !/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname) &&
    !/^\/t\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    throw new Error(
      'Use a TikTok video link or a supported short link, not a profile or collection.',
    );
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  if (['tiktok.com', 'm.tiktok.com'].includes(url.hostname)) url.hostname = 'www.tiktok.com';
  return url.href;
}
export async function contentKey(text: string) {
  const data = new TextEncoder().encode(text.trim().replace(/\s+/g, ' ').toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const categoryImage = (category: string) =>
  ['Coffee'].includes(category)
    ? '/images/cafe.png'
    : category === 'Food & drink'
      ? '/images/restaurant.jpg'
      : ['Outdoors', 'Arts & culture'].includes(category)
        ? '/images/coast.jpg'
        : '/images/city.jpg';
