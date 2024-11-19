import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const articles = pgTable("articles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url"),
  audioUrl: text("audio_url"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata").default({})
});

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = z.infer<typeof selectArticleSchema>;
