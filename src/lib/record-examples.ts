/** A latest raw record may cancel prior activity. Never replace it with an older positive row. */
export function usableExample(record: { amount: number; memo: string | null }) {
  return record.amount > 0 && !/\bvoid(?:ed)?\b/i.test(record.memo || "");
}
