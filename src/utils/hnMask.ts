// =============================================================================
// HN Privacy Masking Utility
// =============================================================================
//
// ตาม requirement EC: หน้าจอแผงควบคุมส่วนกลางจะไม่แสดง HN แบบเต็ม
// แสดงเฉพาะ 4 หลักสุดท้าย เช่น HN-660001 → HN-**0001
// =============================================================================

/**
 * Mask a Hospital Number (HN) to show only the last 4 digits.
 * 
 * @example
 * maskHN('HN-660001') // → 'HN-**0001'
 * maskHN('HN-660042') // → 'HN-**0042'
 * maskHN('HN-1234')   // → 'HN-1234' (4 digits or fewer — no masking needed)
 */
export function maskHN(hn: string): string {
  // Match pattern: prefix (HN-) followed by digits
  const match = hn.match(/^(HN-)(\d+)$/i);
  if (!match) return hn; // Return as-is if format doesn't match

  const prefix = match[1];
  const digits = match[2];

  // If 4 digits or fewer, no masking needed
  if (digits.length <= 4) return hn;

  // Replace leading digits with asterisks, keep last 4
  const maskedPart = '*'.repeat(digits.length - 4);
  const visiblePart = digits.slice(-4);

  return `${prefix}${maskedPart}${visiblePart}`;
}
