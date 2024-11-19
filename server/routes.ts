import type { Express } from "express";
import { db } from "../db";
import { articles } from "../db/schema";
import { generateSpeech, extractArticle } from "./openai";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express) {
  app.post("/api/articles", async (req, res) => {
    try {
      const { url, content } = req.body;
      let articleData;

      if (url) {
        articleData = await extractArticle(url);
      } else {
        articleData = { title: "Custom Text", content };
      }

      const [article] = await db.insert(articles).values({
        title: articleData.title,
        content: articleData.content,
        url: url || null,
        status: "processing"
      }).returning();

      // Generate speech in background
      generateSpeech(articleData.content)
        .then(async (audioBuffer) => {
          // In a real app, save to cloud storage and get URL
          const audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
          await db.update(articles)
            .set({ audioUrl, status: "completed" })
            .where(eq(articles.id, article.id));
        })
        .catch(async (error) => {
          await db.update(articles)
            .set({ status: "failed", metadata: { error: error.message } })
            .where(eq(articles.id, article.id));
        });

      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/articles", async (req, res) => {
    try {
      const allArticles = await db.select().from(articles);
      res.json(allArticles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/articles/:id", async (req, res) => {
    try {
      const [article] = await db.select()
        .from(articles)
        .where(eq(articles.id, parseInt(req.params.id)));
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
