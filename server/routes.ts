// Content remains same except for line 115
import type { Express } from "express";
import { db } from "../db";
import { articles } from "../db/schema";
import { generateSpeech, extractArticle, generatePodcastFilename } from "./openai";
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

    // Enhanced paywall patterns in URLs
    const paywallPatterns = [
      /\/subscribe\//i,
      /\/subscription\//i,
      /\/premium\//i,
      /\/member(s|ship)\//i,
      /\/signin\//i,
      /\/login\//i,
      /\/locked\//i,
      /\/register\//i,
      /\/account\//i,
      /\/subscribers(-|\/)?only/i,
      /\/paid(-|\/)?content/i,
      /\/exclusive\//i,
      /\/(ad)?paywall\//i,
      /\/upgrade\//i
    ];

    if (paywallPatterns.some(pattern => pattern.test(parsedUrl.pathname))) {
      return { 
        valid: false, 
        error: 'This appears to be a subscription/premium content URL. Please provide a public article URL.' 
      };
    }

    // Enhanced headers for better compatibility
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1'
    };

    // First try HEAD request
    const headResponse = await fetch(url, {
      method: 'HEAD',
      headers
    });

    // Check for authentication/paywall status codes
    if (headResponse.status === 401 || headResponse.status === 403) {
      return { 
        valid: false, 
        error: 'This content requires authentication. Please provide a publicly accessible article URL.' 
      };
    }

    // For other non-200 status codes, try a GET request as some sites block HEAD
    if (!headResponse.ok) {
      const getResponse = await fetch(url, {
        method: 'GET',
        headers
      });

      // Common paywall detection in response
      const text = await getResponse.text();
      const paywallKeywords = [
        'subscribe to continue',
        'subscription required',
        'premium content',
        'premium article',
        'members only',
        'sign in to read',
        'login to continue',
        'create an account',
        'premium access',
        'unlock full access',
        'register to continue',
        'subscribe now',
        'exclusive content',
        'paid subscribers',
        'subscribe for unlimited access',
        'premium membership required',
        'ad-free access',
        'support quality journalism'
      ];

      const lowerText = text.toLowerCase();
      if (paywallKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        return {
          valid: false,
          error: 'This article appears to be behind a paywall. Please provide a publicly accessible article.'
        };
      }

      // Check for login forms
      if (text.includes('type="password"') || 
          (text.includes('type="email"') && text.includes('login'))) {
        return {
          valid: false,
          error: 'This page requires authentication. Please provide a publicly accessible article URL.'
        };
      }

      // Check content type if available
      const contentType = getResponse.headers.get('content-type');
      if (contentType && !contentType.includes('text/html')) {
        return { valid: false, error: 'URL must point to an HTML page' };
      }

      if (!getResponse.ok) {
        const statusMessages: { [key: number]: string } = {
          401: 'This content requires authentication.',
          403: 'Access forbidden. The website might be blocking automated access.',
          404: 'Article not found. Please check if the URL is correct.',
          429: 'Too many requests. Please wait a few minutes and try again.',
          500: 'Server error. The website might be experiencing issues.',
          503: 'Service unavailable. The website might be under maintenance.'
        };

        return { 
          valid: false, 
          error: statusMessages[getResponse.status] || `URL returned status code ${getResponse.status}`
        };
      }
    }

    return { valid: true };
  } catch (error: any) {
    const errorMessage = error.message || 'Invalid or inaccessible URL';
    return { 
      valid: false, 
      error: errorMessage.includes('fetch') ? 
        'Could not access the URL. Please check your internet connection and the URL validity.' : 
        errorMessage
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

      // Set podcast metadata with enhanced description handling
      const podcastTitle = articleData.title;
      // Use og_description if available, otherwise use title with fallback to truncated content
      const podcastDescription = articleData.ogDescription || 
                                `${articleData.title} - ${articleData.content.substring(0, 500)}...`;
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
        ogDescription: articleData.ogDescription,
        ogDescriptionSource: articleData.ogDescriptionSource,
        ogDescriptionGeneratedAt: new Date(),
        ogImageUrl: articleData.ogImageUrl
      }).returning();

      // Ensure audio directory exists
      const audioDir = join(process.cwd(), 'public/audio');
      await mkdir(audioDir, { recursive: true });

      // Generate speech in background
      generateSpeech(articleData.content, {
        title: podcastTitle,
        episodeNumber: nextEpisodeNumber,
        description: podcastDescription,
        subtitle: `Episode ${nextEpisodeNumber}: ${podcastTitle}`
      })
        .then(async ({ buffer: audioBuffer, validation }) => {
          const audioFileName = generatePodcastFilename(nextEpisodeNumber, podcastTitle);
          const audioPath = join(process.cwd(), 'public/audio', audioFileName);
          
          // Save audio file to disk
          await writeFile(audioPath, audioBuffer);

          // Prepare metadata with validation results
          const metadata = {
            ...validation.metadata,
            validationErrors: validation.errors,
            validationWarnings: validation.warnings,
            isValidPodcast: validation.isValid
          };
          
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
                ...metadata,
                duration: validation.metadata.duration || audioDuration,
                contentLength: validation.metadata.fileSize || contentLength
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
        // Get the episode number and title for the podcast filename
        const audioFileName = generatePodcastFilename(article.episodeNumber, article.podcastTitle || article.title);
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
