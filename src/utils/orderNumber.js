/**
 * Generate a short, human-readable order number.
 * Format: ORD-YYYYMMDD-XXXXX  (e.g. ORD-20260305-A3F9C)
 */
function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${date}-${rand}`;
}

module.exports = { generateOrderNumber };
