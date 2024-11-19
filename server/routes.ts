import type { Express } from "express";
import { db } from "../db";
import { articles } from "../db/schema";
import { generateSpeech, extractArticle } from "./openai";
import { generateRssFeed } from "./rss";
import { eq, max } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface AudioMetadata {
  duration?: number;
  contentLength?: number;
  error?: string;
}

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

      // Set podcast metadata
      const podcastTitle = articleData.title;
      const podcastDescription = articleData.content.substring(0, 1000) + '...'; // Truncate for description
      const publishedAt = new Date();

      const [article] = await db.insert(articles).values({
        title: articleData.title,
        content: articleData.content,
        url: url || null,
        status: "processing",
        publishedAt,
        episodeNumber: nextEpisodeNumber,
        podcastTitle,
        podcastDescription,
        metadata: {}, // Initialize empty metadata as JSONB
      }).returning();

      // Ensure audio directory exists
      const audioDir = join(process.cwd(), 'public/audio');
      await mkdir(audioDir, { recursive: true });

      // Generate speech in background
      generateSpeech(articleData.content)
        .then(async (audioBuffer) => {
          const audioFileName = `${article.id}.mp3`;
          const audioPath = join(process.cwd(), 'public/audio', audioFileName);
          
          // Save audio file to disk
          await writeFile(audioPath, audioBuffer);
          
          // Set audio URL as public path with /public prefix
          const audioUrl = `/public/audio/${audioFileName}`;
          
          // Calculate audio duration and file size
          const sampleRate = 44100; // 44.1kHz
          const channels = 2; // Stereo
          const bytesPerSample = 2; // 16-bit audio
          const audioDuration = Math.ceil(audioBuffer.length / (sampleRate * channels * bytesPerSample));
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
        .catch(async (error: Error) => {
          console.error('Speech generation error:', error);
          await db.update(articles)
            .set({ 
              status: "failed", 
              metadata: {
                error: error.message 
              }
            })
            .where(eq(articles.id, article.id));
        });

      res.json(article);
    } catch (error: any) {
      console.error('Article creation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/articles", async (req, res) => {
    try {
      const allArticles = await db.select().from(articles);
      res.json(allArticles);
    } catch (error: any) {
      console.error('Article fetch error:', error);
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
    } catch (error: any) {
      console.error('Single article fetch error:', error);
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
    } catch (error: any) {
      console.error('RSS feed generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
