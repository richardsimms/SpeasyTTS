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

    // Enhanced paywall and authentication patterns with comprehensive detection
    const restrictedPatterns = [
      // Web-share and authentication patterns
      /app\.sparkmailapp\.com\/web-share/i,
      /\/shared\/view/i,
      /\/shared-content/i,
      /\/web-share/i,
      /\/auth(-|\/)?required/i,
      
      // Subscription patterns
      /\/subscriber(-|\/)?only/i,
      /\/premium(-|\/)?content/i,
      /\/members(-|\/)?only/i,
      /\/paid(-|\/)?content/i,
      /\/exclusive\//i,
      /\/(ad)?paywall\//i,
      /\/upgrade\//i,
      /\/unlock\//i,
      /\/vip\//i,
      /\/protected\//i,
      /\/plus\//i,
      /\/pro\//i,
      
      // Access control patterns
      /\/access(-|\/)?denied/i,
      /\/authentication(-|\/)?required/i,
      /\/restricted(-|\/)?content/i,
      /\/members(-|\/)?area/i,
      /\/subscriber(-|\/)?content/i,
      /\/premium(-|\/)?access/i,
      
      // Additional paywall indicators
      /\/subscribe(-|\/)?to(-|\/)?continue/i,
      /\/register(-|\/)?to(-|\/)?read/i,
      /\/subscription(-|\/)?required/i,
      /\/premium(-|\/)?article/i,
      /\/premium(-|\/)?story/i,
      /\/membership(-|\/)?required/i,
      /\/signin(-|\/)?required/i,
      /\/login(-|\/)?required/i,
      /\/subscriber(-|\/)?exclusive/i,
      
      // Publication-specific patterns
      /\/ft\.com\/content/i,  // Financial Times
      /\/wsj\.com\/articles/i, // Wall Street Journal
      /\/economist\.com\/\w+\/\d{4}/i, // The Economist
      /\/nytimes\.com\/\d{4}/i, // New York Times
      /\/bloomberg\.com\/news/i, // Bloomberg
      /\/barrons\.com\/articles/i, // Barron's
      /\/hbr\.org\/\d{4}/i, // Harvard Business Review
      /\/medium\.com\/membership/i, // Medium membership
      /\/seekingalpha\.com\/article/i, // Seeking Alpha
      
      // Query parameter patterns
      /\?(.+&)?subscription=/i,
      /\?(.+&)?paywall=/i,
      /\?(.+&)?subscribe=/i,
      /\?(.+&)?premium=/i,
      /\?(.+&)?membership=/i,
      
      // Metered paywall indicators
      /\/metered(-|\/)?content/i,
      /\/metered(-|\/)?article/i,
      /\/remaining(-|\/)?views/i,
      /\/free-views-remaining/i,
      /\/article-limit-reached/i
    ];

    // Enhanced paywall detection - check both pathname and search parameters
    const urlString = parsedUrl.pathname + parsedUrl.search;
    
    // Check for web-share URLs first
    if (parsedUrl.hostname.includes('sparkmailapp.com') || /web-share|shared/.test(urlString)) {
      return {
        valid: false,
        error: 'This appears to be a web-share or email preview link that requires authentication.\n\n' +
               'To fix this:\n' +
               '1. Copy the actual article text and use the direct text input method\n' +
               '2. Find and use the original article URL instead\n' +
               '3. Make sure you\'re using a publicly accessible URL'
      };
    }
    
    if (restrictedPatterns.some(pattern => pattern.test(urlString))) {
      return { 
        valid: false, 
        error: 'This content appears to be behind a paywall. Please:\n' +
               '1. Use the direct text input method instead\n' +
               '2. Find a publicly accessible version\n' +
               '3. Try a different article from a non-paywalled source'
      };
    }

    // Check if URL is accessible with enhanced error handling
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow'
    });

    // Enhanced HTTP status code handling with more detailed error messages
    if (!response.ok) {
      const status = response.status;
      const location = response.headers.get('location');
      
      // Check if redirected to a login page
      if (location?.includes('login') || location?.includes('signin')) {
        return {
          valid: false,
          error: 'This content requires authentication. Please:\n' +
                '1. Use the direct text input method instead\n' +
                '2. Find a publicly accessible version\n' +
                '3. Try a different article from a non-paywalled source'
        };
      }

      switch (status) {
        case 401:
          return { 
            valid: false, 
            error: 'This content requires authentication.\n\n' +
                  'Common reasons:\n' +
                  '• Login required\n' +
                  '• Subscription needed\n' +
                  '• Token expired or invalid\n\n' +
                  'Steps to resolve:\n' +
                  '1. Use the direct text input method instead\n' +
                  '2. Find a publicly accessible version\n' +
                  '3. Try a different article\n\n' +
                  'Suggestions:\n' +
                  '• Copy the article text directly\n' +
                  '• Look for alternative sources\n' +
                  '• Check if an archive version exists'
          };
        case 403:
          return { 
            valid: false, 
            error: 'Access to this content is forbidden.\n\n' +
                  'Common reasons:\n' +
                  '• Paywall protection\n' +
                  '• Geographic restrictions\n' +
                  '• Anti-bot measures\n' +
                  '• Subscription required\n\n' +
                  'Steps to resolve:\n' +
                  '1. Switch to direct text input\n' +
                  '2. Use a publicly accessible version\n' +
                  '3. Check regional availability\n' +
                  '4. Try an alternative source\n\n' +
                  'Suggestions:\n' +
                  '• Use reader mode in your browser\n' +
                  '• Check for cached versions\n' +
                  '• Look for syndicated content'
          };
        case 404:
          return { 
            valid: false, 
            error: 'The article could not be found. Please check:\n' +
                  '1. The URL is typed correctly\n' +
                  '2. The article hasn\'t been moved or deleted\n' +
                  '3. You have the correct link'
          };
        case 429:
          return { 
            valid: false, 
            error: 'Too many requests. This usually means:\n' +
                  '1. The website is rate-limiting access\n' +
                  '2. You need to wait a few minutes before trying again\n' +
                  '3. Consider using the direct text input method instead'
          };
        case 451:
          return {
            valid: false,
            error: 'This content is unavailable for legal reasons. This could be due to:\n' +
                  '1. Geographic restrictions (region-locked content)\n' +
                  '2. Copyright claims\n' +
                  '3. Legal takedown notices\n\n' +
                  'Try finding an alternative source or use direct text input.'
          };
        default:
          return { 
            valid: false, 
            error: `The article is not accessible (Status ${status}). Common solutions:\n` +
                  '1. Check if the website is working\n' +
                  '2. Try accessing the URL in your browser first\n' +
                  '3. Use the direct text input method instead'
          };
      }
    }

    // Check content type with enhanced validation
    const contentType = response.headers.get('content-type');
    if (!contentType) {
      return { 
        valid: false, 
        error: 'Could not determine content type. Please ensure the URL points to an article.' 
      };
    }
    
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { 
        valid: false, 
        error: 'URL must point to a web article (HTML content).' 
      };
    }

    return { valid: true };
  } catch (error: any) {
    // Enhanced error messages for common issues
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { 
        valid: false, 
        error: 'Could not connect to the website. Please check your internet connection and the URL.' 
      };
    }
    
    return { 
      valid: false, 
      error: error.message || 'The URL is invalid or the content is inaccessible.' 
    };
  }
}

export function registerRoutes(app: Express) {
  app.post("/api/articles", async (req, res) => {
    try {
      console.log('Article conversion request:', req.body);
      const { url, content } = req.body;
      let articleData;

      const MAX_CONTENT_LENGTH = 100000; // Maximum content length allowed
      
      if (url) {
        console.log('Processing URL:', url);
        // Validate URL before processing
        const validation = await validateUrl(url);
        if (!validation.valid) {
          console.log('URL validation failed:', validation.error);
          return res.status(400).json({ 
            error: validation.error || 'Invalid URL'
          });
        }

        articleData = await extractArticle(url);
        
        // Validate extracted content length
        if (articleData.content.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({
            error: `Article content is too long. Maximum allowed length is ${MAX_CONTENT_LENGTH} characters.`
          });
        }
      } else if (content) {
        // Validate direct input content length
        if (content.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({
            error: `Article content is too long. Maximum allowed length is ${MAX_CONTENT_LENGTH} characters.`
          });
        }
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
