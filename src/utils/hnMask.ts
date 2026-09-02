// =============================================================================
// HN Privacy Masking Utility
// =============================================================================
//
// ตาม requirement Privacy:
// หน้าจอแผงควบคุมส่วนกลางแสดงเฉพาะ "4 หลักสุดท้าย" ของ HN เท่านั้น
// เช่น HN19086455 → HN****6455
//      HN-660001  → HN****0001
// =============================================================================

/**
 * Mask a Hospital Number (HN) to show ONLY last 4 digits with HN prefix.
 * Supports formats: HN19086455, HN-660001, 19086455, etc.
 *
 * @example
 * maskHN('HN19086455') // → 'HN****6455'
 * maskHN('HN-660001')  // → 'HN****0001'
 * maskHN('12345678')   // → 'HN****5678'
 */
export function maskHN(hn: string): string {
  if (!hn) return 'HN****';

  // Extract only the digit portion (strip any letter/dash prefix)
  const digitsOnly = hn.replace(/^[a-zA-Z\-]+/, '');

  if (!digitsOnly) return 'HN****';

  // Always show ONLY the last 4 digits with HN**** prefix
  const last4 = digitsOnly.slice(-4).padStart(4, '0');
  return `HN****${last4}`;
}
