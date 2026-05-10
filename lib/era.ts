import type { HistoricalEvent } from "./types";

export function yearToEra(year: number): HistoricalEvent["era"] {
  if (year < 500) return "ancient";
  if (year < 1500) return "medieval";
  if (year < 1800) return "early-modern";
  if (year < 1900) return "19c";
  if (year < 2000) return "20c";
  return "21c";
}
