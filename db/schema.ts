import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Define metadata type schema
const audioMetadataSchema = z.object({
  duration: z.number().optional(),
  contentLength: z.number().optional(),
  error: z.string().optional()
});

export const articles = pgTable("articles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url"),
  audioUrl: text("audio_url"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<z.infer<typeof audioMetadataSchema>>().default({}),
  // RSS podcast metadata fields
  podcastTitle: text("podcast_title"),
  podcastDescription: text("podcast_description"),
  episodeNumber: integer("episode_number"),
  publishedAt: timestamp("published_at"),
  // OpenGraph metadata fields
  ogDescription: text("og_description"),
  ogDescriptionSource: text("og_description_source"),
  ogDescriptionGeneratedAt: timestamp("og_description_generated_at", { withTimezone: true }),
  ogImageUrl: text("og_image_url")
});

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = z.infer<typeof selectArticleSchema>;
export type AudioMetadata = z.infer<typeof audioMetadataSchema>;
