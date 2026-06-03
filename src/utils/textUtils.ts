export const normalizeArabic = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, '') // Remove diacritics (Harakat)
    .replace(/[أإآ]/g, 'ا')        // Normalize Alifs
    .replace(/ة/g, 'ه')            // Normalize Teh Marbuta
    .replace(/[ىي]/g, 'ي')          // Normalize Yeh
    .replace(/\s+/g, ' ')          // Normalize multiple spaces
    .trim();
};
