import type { Express } from "express";
import { db } from "../db";
import { articles } from "../db/schema";
import { generateSpeech, extractArticle } from "./openai";
import { generateRssFeed } from "./rss";
import { eq, max } from "drizzle-orm";

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

      // Get the latest episode number
      const [latestEpisode] = await db
        .select({ maxEpisode: max(articles.episodeNumber) })
        .from(articles);
      const nextEpisodeNumber = (latestEpisode?.maxEpisode || 0) + 1;

      const [article] = await db.insert(articles).values({
        title: articleData.title,
        content: articleData.content,
        url: url || null,
        status: "processing",
        publishedAt: new Date(),
        episodeNumber: nextEpisodeNumber,
        podcastTitle: articleData.title,
        podcastDescription: articleData.content.substring(0, 1000) + '...' // Truncate for description
      }).returning();

      // Generate speech in background
      generateSpeech(articleData.content)
        .then(async (audioBuffer) => {
          // In a real app, save to cloud storage and get URL
          const audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
          
          // Get audio duration and file size
          const audioDuration = Math.ceil(audioBuffer.length / (44100 * 2 * 2)); // Approximate duration for 44.1kHz stereo
          const contentLength = audioBuffer.length;

          await db.update(articles)
            .set({ 
              audioUrl, 
              status: "completed",
              metadata: {
                duration: audioDuration,
                contentLength: contentLength
              }
            })
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

  // RSS feed endpoint
  app.get("/api/feed.xml", async (req, res) => {
    try {
      const allArticles = await db.select().from(articles);
      const rssFeed = generateRssFeed(allArticles);
      res.set('Content-Type', 'application/xml');
      res.send(rssFeed);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
