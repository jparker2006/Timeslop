import data from "../data/events.json";
import { HistoricalEventSchema, type HistoricalEvent } from "./types";

// Only fame=3 events are flagged as "selected" so Easy mode still has enough
// events when falling back to the bundled seed.
export const SEED_EVENTS: HistoricalEvent[] = data.map((e) => {
  const parsed = HistoricalEventSchema.parse(e);
  return {
    ...parsed,
    selected: parsed.selected ?? parsed.fame === 3,
  };
});
