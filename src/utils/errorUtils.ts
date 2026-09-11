/**
 * Safely extract a displayable error string from any API error response.
 * Prevents React child rendering errors when backend returns object/array validation errors.
 */
export function extractErrorMessage(detail: unknown, fallback: string = 'เกิดข้อผิดพลาดในการดำเนินการ'): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        const msg = item.msg || item.message;
        if (msg) return String(msg).replace(/^Value error,\s*/, '');
        return JSON.stringify(item);
      })
      .filter(Boolean);
    return msgs.length > 0 ? msgs.join(' | ') : fallback;
  }
  if (typeof detail === 'object') {
    const obj = detail as Record<string, unknown>;
    if (obj.msg) return String(obj.msg).replace(/^Value error,\s*/, '');
    if (obj.message) return String(obj.message);
    if (obj.detail) return extractErrorMessage(obj.detail, fallback);
    return JSON.stringify(detail);
  }
  return String(detail);
}
