import data from "../data/events.json";
import { HistoricalEventSchema, type HistoricalEvent } from "./types";

export const SEED_EVENTS: HistoricalEvent[] = data.map((e) =>
  HistoricalEventSchema.parse(e),
);
