export function safeHref(value) {
  try {
    if (typeof value !== 'string') return '#';
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '#';
  } catch { return '#'; }
}
