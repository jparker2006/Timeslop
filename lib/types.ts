import { z } from "zod";

export const HistoricalEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  yearOnly: z.boolean().optional(),
  blurb: z.string().min(1),
  wikipediaUrl: z.string().url(),
  era: z.enum(["ancient", "medieval", "early-modern", "19c", "20c", "21c"]),
  fame: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export type HistoricalEvent = z.infer<typeof HistoricalEventSchema>;

export const HeadlineSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blurb: z.string(),
  source: z.string(),
  url: z.string().url(),
});
export type Headline = z.infer<typeof HeadlineSchema>;

export type RevealedSlot = {
  id: string;
  kind: "historical" | "headline";
  title: string;
  date: string;
  blurb: string;
  url: string;
  yearOnly: boolean;
  source?: string;
};

export type PuzzlePayload = {
  puzzleId: string;
  revealOrder: string[];
  slots: RevealedSlot[];
};
