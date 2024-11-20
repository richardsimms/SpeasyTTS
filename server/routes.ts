// Content remains same except for line 115
import type { Express } from "express";
import { db } from "../db";
import { articles } from "../db/schema";
import { generateSpeech, extractArticle } from "./openai";
import { generateRssFeed } from "./rss";
import { eq, max } from "drizzle-orm";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface AudioMetadata {
  duration?: number;
  contentLength?: number;
  error?: string;
}

// URL validation function
async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check URL format
    const parsedUrl = new URL(url);
    
    // Only allow http/https schemes
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Check if URL is accessible
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Speasy-Bot/1.0' }
    });

    // Accept 200-299 status codes
    if (!response.ok) {
      return { valid: false, error: `URL returned status code ${response.status}` };
    }

    // Check content type if available
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('text/html')) {
      return { valid: false, error: 'URL must point to an HTML page' };
    }

    return { valid: true };
  } catch (error: any) {
    return { 
      valid: false, 
      error: error.message || 'Invalid or inaccessible URL' 
    };
  }
}

export function registerRoutes(app: Express) {
  app.post("/api/articles", async (req, res) => {
    try {
      const { url, content } = req.body;
      let articleData;

      if (url) {
        // Validate URL before processing
        const validation = await validateUrl(url);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: validation.error || 'Invalid URL'
          });
        }

        articleData = await extractArticle(url);
      } else if (content) {
        articleData = { title: "Custom Text", content };
      } else {
        return res.status(400).json({
          error: "Either URL or content must be provided"
        });
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
          
          // Set audio URL without /public prefix
          const audioUrl = `/audio/${audioFileName}`;
          
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

  // Delete article endpoint
  app.delete("/api/articles/:id", async (req, res) => {
    try {
      const articleId = parseInt(req.params.id);
      
      // Get article before deletion to check audio file
      const [article] = await db.select()
        .from(articles)
        .where(eq(articles.id, articleId));
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Delete the audio file if it exists
      if (article.audioUrl) {
        const audioFileName = `${articleId}.mp3`;
        const audioPath = join(process.cwd(), 'public/audio', audioFileName);
        
        if (existsSync(audioPath)) {
          await unlink(audioPath);
        }
      }

      // Delete from database
      await db.delete(articles).where(eq(articles.id, articleId));
      
      res.status(204).send();
    } catch (error: any) {
      console.error('Article deletion error:', error);
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
