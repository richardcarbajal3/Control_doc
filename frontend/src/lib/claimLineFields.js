// Complementary per-line fields shown for each document inside a claim.
// Stored in documents.claim_data (JSONB) keyed by `key`. Rename the `label`
// values here later when the real meaning of each field is decided — no DB
// change needed. Add/remove entries to add/remove columns.
export const CLAIM_LINE_FIELDS = [
  { key: 'campo1', label: 'Campo 1' },
  { key: 'campo2', label: 'Campo 2' },
  { key: 'campo3', label: 'Campo 3' },
];
