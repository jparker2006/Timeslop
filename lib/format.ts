const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatEventDate(iso: string, yearOnly: boolean): string {
  const [yStr, mStr, dStr] = iso.split("-");
  const year = parseInt(yStr, 10);
  const yearLabel = year < 1000 ? `AD ${year}` : `${year}`;
  if (yearOnly) return yearLabel;
  const month = MONTHS[parseInt(mStr, 10) - 1] ?? "";
  const day = parseInt(dStr, 10);
  return `${month} ${day}, ${yearLabel}`;
}

export function formatPuzzleDate(iso: string): string {
  const [yStr, mStr, dStr] = iso.split("-");
  const month = MONTHS[parseInt(mStr, 10) - 1] ?? "";
  return `${month} ${parseInt(dStr, 10)}, ${yStr}`;
}
