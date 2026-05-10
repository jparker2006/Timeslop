const CURRENT_YEAR = new Date().getFullYear();

// Mask anything that looks like a year (1-current year + 1) including decade
// references like "1960s". Replaces with XXXX so titles/blurbs don't leak the
// answer to the player before they place the card.
export function maskDates(input: string): string {
  return input.replace(/\b(\d{4})(s)?\b/g, (match, yearStr, suffix) => {
    const n = parseInt(yearStr, 10);
    if (n >= 1 && n <= CURRENT_YEAR + 1) {
      return suffix ? "XXXXs" : "XXXX";
    }
    return match;
  });
}
