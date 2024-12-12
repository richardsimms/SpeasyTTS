import OpenAI from "openai";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to chunk text into segments under OpenAI's limit with safety buffer
function chunkText(text: string): string[] {
  const MAX_CHUNK_SIZE = 3800; // Buffer for OpenAI's 4096 limit
  const MIN_CHUNK_SIZE = 100;  // Minimum reasonable chunk size
  const chunks: string[] = [];
  let currentChunk = "";

  // Enhanced sentence splitting with multiple delimiters
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);

  for (const sentence of sentences) {
    // Handle oversized sentences by splitting at commas or natural breaks
    if (sentence.length > MAX_CHUNK_SIZE) {
      const subSentences = sentence.split(/(?<=,|\sand\s|\sor\s|\sbut\s|\;)\s+/);
      for (const subSentence of subSentences) {
        if (subSentence.length > MAX_CHUNK_SIZE) {
          // If still too long, force split at MAX_CHUNK_SIZE with word boundaries
          const words = subSentence.split(/\s+/);
          let subChunk = "";
          for (const word of words) {
            if ((subChunk + " " + word).length <= MAX_CHUNK_SIZE) {
              subChunk += (subChunk ? " " : "") + word;
            } else {
              if (subChunk.length >= MIN_CHUNK_SIZE) chunks.push(subChunk);
              subChunk = word;
            }
          }
          if (subChunk.length >= MIN_CHUNK_SIZE) chunks.push(subChunk);
        } else {
          if ((currentChunk + " " + subSentence).length <= MAX_CHUNK_SIZE) {
            currentChunk += (currentChunk ? " " : "") + subSentence;
          } else {
            if (currentChunk.length >= MIN_CHUNK_SIZE) chunks.push(currentChunk);
            currentChunk = subSentence;
          }
        }
      }
    } else {
      if ((currentChunk + " " + sentence).length <= MAX_CHUNK_SIZE) {
        currentChunk += (currentChunk ? " " : "") + sentence;
      } else {
        if (currentChunk.length >= MIN_CHUNK_SIZE) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.length >= MIN_CHUNK_SIZE) chunks.push(currentChunk);
  return chunks;
}

// Generate speech for a single chunk with validation and error handling
async function generateSpeechChunk(text: string): Promise<Buffer> {
  // Validate chunk size before sending to OpenAI
  if (!text || text.length === 0) {
    throw new Error("Empty text chunk received");
  }
  
  if (text.length > 4096) {
    throw new Error(`Chunk size (${text.length}) exceeds OpenAI's limit of 4096 characters`);
  }

  try {
    const response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "alloy",
      input: text,
      response_format: "mp3",
      speed: 1.0
    });

    return Buffer.from(await response.arrayBuffer());
  } catch (error: any) {
    // Enhanced error handling with specific messages
    if (error.message?.includes('string_too_long')) {
      throw new Error(`Text chunk exceeds OpenAI's character limit. Length: ${text.length}`);
    }
    throw new Error(`Speech generation failed: ${error.message}`);
  }
}

// Helper function to sanitize title for filenames
function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

// Helper function to generate standardized filename
export function generatePodcastFilename(episodeNumber: number, title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedTitle = sanitizeTitle(title);
  return `${date}-episode-${episodeNumber}-${sanitizedTitle}.mp3`;
}

interface ExtractedMetadata {
  title: string;
  content: string;
  ogDescription?: string;
  ogDescriptionSource?: string;
  ogImageUrl?: string;
}

// Enhanced content extraction with Puppeteer and better error handling
export async function extractArticle(url: string): Promise<ExtractedMetadata> {
  try {
    // Import playwright
    const { chromium } = await import('playwright');
    
    // Launch browser with enhanced stealth mode
    console.log('Launching Playwright browser for URL:', url);
    
    let browser;
    try {
      // Launch browser with minimal requirements
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--single-process',
          '--no-zygote'
        ]
      });
      
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const page = await context.newPage();
      
      console.log('Attempting to navigate to URL:', url);
      
      // Enhanced navigation with authentication handling
      const response = await page.goto(url, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      console.log('Navigation response status:', response?.status());
      console.log('Current page URL:', page.url());

      // Check if we were redirected to a login page
      const currentUrl = page.url().toLowerCase();
      console.log('Final URL after potential redirects:', currentUrl);
      
      if (currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('auth')) {
        throw new Error(
          'This content requires authentication. Please try one of these methods:\n' +
          '1. Wait a few minutes and try again (if rate-limited)\n' +
          '2. Copy the article text and use the direct text input method\n' +
          '3. Find the original article URL instead of the web-share link'
        );
      }
      
      // Check if the page loaded successfully
      const mainContent = await page.$('body');
      if (!mainContent) {
        throw new Error('Could not load the article content. The page might be protected or require authentication.');
      }
      
      // Check for common error messages or blocking elements
      const errorTexts = await page.$$eval('*', (elements) => {
        return elements
          .map(el => el.textContent)
          .filter(text => text && (
            text.includes('Access Denied') ||
            text.includes('Login Required') ||
            text.includes('Authentication Required') ||
            text.includes('Please sign in')
          ));
      });
      
      if (errorTexts.length > 0) {
        throw new Error(
          'Access to this content is restricted. Please try:\n' +
          '1. Using the direct text input method\n' +
          '2. Finding the original article URL\n' +
          '3. Ensuring you have proper access rights'
        );
      }

      // Wait for potential JavaScript redirects
      await page.waitForTimeout(2000);
      
      // Wait for main content to load
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Get the page content
      const content = await page.content();

    // Enhanced error handling with specific messages
    if (!response.ok) {
      const errorMessages: { [key: number]: string } = {
        401: 'This article requires authentication. Please try a publicly accessible URL.',
        403: 'Access forbidden. The website might be blocking automated access.',
        404: 'Article not found. Please check if the URL is correct.',
        429: 'Too many requests. Please wait a few minutes and try again.',
        500: 'Server error. The website might be experiencing issues.',
        503: 'Service unavailable. The website might be under maintenance.'
      };
      throw new Error(errorMessages[response.status] || `Failed to fetch article: ${response.status}`);
    }

    // Sanitize the obtained content
    const sanitizedHtml = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/ style="[^"]*"/g, '')
      .replace(/ on\w+="[^"]*"/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();

    // Parse HTML with enhanced JSDOM configuration
    const dom = new JSDOM(sanitizedHtml, {
      url: url,
      pretendToBeVisual: true,
      runScripts: 'outside-only'
    });

    // Configure Readability with enhanced options
    const reader = new Readability(dom.window.document, {
      charThreshold: 100,
      classesToPreserve: ['article', 'content', 'post'],
      keepClasses: true,
      debug: false,
      nbTopCandidates: 5,
      maxElemsToParse: 0,
      weightClasses: true
    });

    const article = reader.parse();
    if (!article) {
      throw new Error('Failed to parse article content. The content might be dynamic or protected.');
    }

    // Enhanced metadata extraction
    const document = dom.window.document;
    const metaTags = {
      title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
             document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
             document.querySelector('meta[name="title"]')?.getAttribute('content'),
      description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                  document.querySelector('meta[name="description"]')?.getAttribute('content'),
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') ||
              document.querySelector('meta[property="article:author"]')?.getAttribute('content'),
      published: document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
    };

    // Configure TurndownService with enhanced options
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'referenced',
      linkReferenceStyle: 'full'
    });

    // Add custom rules for better content preservation
    turndownService.addRule('paragraphSpacing', {
      filter: 'p',
      replacement: (content) => '\n\n' + content + '\n\n'
    });

    turndownService.addRule('preserveLineBreaks', {
      filter: ['br'],
      replacement: () => '  \n'
    });

    turndownService.addRule('nestedLists', {
      filter: ['li'],
      replacement: (content, node, options) => {
        content = content
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
          .replace(/\n/gm, '\n    ');
        
        const prefix = options.bulletListMarker + ' ';
        const parent = node.parentNode as HTMLElement;
        const isNested = parent.parentNode?.nodeName.toLowerCase() === 'li';
        const indent = isNested ? '  ' : '';
        
        return indent + prefix + content + (node.nextSibling ? '\n' : '');
      }
    });

    // Convert HTML to Markdown with enhanced formatting
    const markdown = turndownService.turndown(article.content);

    // Validate content length and quality
    if (!markdown || markdown.length < 100) {
      throw new Error('Extracted content is too short or empty. The article might be paywalled.');
    }

    // Format the final content with metadata
    const formattedContent = [
      `# ${metaTags.title || article.title || document.title || 'Untitled Article'}`,
      metaTags.author ? `\nAuthor: ${metaTags.author}` : '',
      metaTags.published ? `\nPublished: ${new Date(metaTags.published).toLocaleString()}` : '',
      metaTags.description ? `\n> ${metaTags.description}\n` : '\n',
      markdown
    ].filter(Boolean).join('\n');

    // Extract OpenGraph metadata with prioritized sources
    const ogDescription = 
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      article.excerpt ||
      article.content.substring(0, 420).trim() + '...';

    const ogImageUrl = 
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

    // Determine description source
    let ogDescriptionSource = 'content:summary';
    if (document.querySelector('meta[property="og:description"]')?.getAttribute('content')) {
      ogDescriptionSource = 'og:description';
    } else if (document.querySelector('meta[name="description"]')?.getAttribute('content')) {
      ogDescriptionSource = 'meta:description';
    }

    // Download and convert og:image if present
    let processedImageUrl = ogImageUrl;
    if (ogImageUrl) {
      try {
        // Download image
        const imageResponse = await fetch(ogImageUrl);
        if (imageResponse.ok) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          
          // Import image processing function
          const { convertToPodcastShowImage } = await import('./image-processing');
          
          // Convert image to podcast format
          const conversionResult = await convertToPodcastShowImage(
            imageBuffer,
            `${sanitizeTitle(article.title)}`
          );
          
          // Use converted image path or fallback to default
          processedImageUrl = conversionResult.path;
          
          // Log conversion results
          if (conversionResult.error) {
            console.warn('Image conversion warning:', conversionResult.error);
          } else {
            console.log('Image conversion successful:', conversionResult.metadata);
          }
        }
      } catch (error) {
        console.error('Failed to process og:image:', error);
      }
    }

    return {
      title: metaTags.title || article.title || document.title || 'Untitled Article',
      content: formattedContent,
      ogDescription: ogDescription ? ogDescription.trim() : undefined,
      ogDescriptionSource,
      ogImageUrl: processedImageUrl
    };

  } finally {
    // Ensure browser is closed
    if (browser) {
      await browser.close();
    }
  }
  } catch (error: any) {
    console.error('Article extraction error:', error);
    
    // Enhanced error categorization for Playwright errors
    const errorMessages: { [key: string]: string } = {
      TypeError: 'Invalid HTML structure or network error',
      SyntaxError: 'Invalid HTML content',
      TimeoutError: 'Page load timed out. This could mean:\n' +
                   '1. The website is blocking automated access\n' +
                   '2. The connection is slow\n' +
                   '3. The page requires authentication\n\n' +
                   'Please try using the direct text input method instead.',
      TargetClosedError: 'The browser was closed unexpectedly',
      WebError: 'Failed to load the webpage',
      BrowserError: 'Could not start the web browser',
      ProtocolError: 'Failed to communicate with the webpage',
      RouteError: 'Network request failed',
      SecurityError: 'Security error occurred (possibly SSL/TLS related)',
      ConsoleMessage: 'Webpage error detected'
    };

    const errorType = Object.keys(errorMessages).find(type => 
      error instanceof Error && (
        error.name.includes(type) || 
        error.message.includes(type.toLowerCase())
      )
    );

    throw new Error(
      errorType 
        ? `${errorMessages[errorType]}\n\nTechnical details: ${error.message}`
        : `Could not extract article content. Please try using the direct text input method.\n\nTechnical details: ${error.message}`
    );
  }
}

// Combine audio buffers using FFmpeg
async function combineAudioBuffers(
  audioBuffers: Buffer[], 
  metadata: {
    title: string;
    episodeNumber: number;
    description?: string;
    subtitle?: string;
  }
): Promise<Buffer> {
  const tempDir = "/tmp";
  const sessionId = randomUUID();
  const inputFiles: string[] = [];
  const inputListFile = join(tempDir, `${sessionId}_list.txt`);
  const outputFile = join(tempDir, generatePodcastFilename(metadata.episodeNumber, metadata.title));

  try {
    // Write each buffer to a temporary file
    for (let i = 0; i < audioBuffers.length; i++) {
      const tempFile = join(tempDir, `${sessionId}_${i}.mp3`);
      await writeFile(tempFile, audioBuffers[i]);
      inputFiles.push(tempFile);
      // Append to FFmpeg concat list file
      await writeFile(
        inputListFile,
        `file '${tempFile}'\n`,
        {
          flag: i === 0 ? 'w' : 'a',
          encoding: 'utf-8'
        }
      );
    }

    // Combine audio files using FFmpeg with enhanced metadata
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', inputListFile,
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-id3v2_version', '3',
        // Basic metadata
        '-metadata', `title=${metadata.title}`,
        '-metadata', 'artist=Speasy',
        '-metadata', 'album=Speasy Podcast',
        '-metadata', 'genre=Podcast',
        // Podcast-specific metadata
        '-metadata', 'podcast=true',
        '-metadata', 'podcast:season=1',
        '-metadata', `podcast:episode=${metadata.episodeNumber}`,
        '-metadata', 'podcast:episodeType=full',
        '-metadata', `itunes:subtitle=${metadata.subtitle || metadata.title}`,
        '-metadata', `itunes:summary=${metadata.description || ''}`,
        '-metadata', 'itunes:author=Speasy',
        '-metadata', 'itunes:category=Technology',
        '-metadata', 'itunes:explicit=false',
        outputFile
      ]);

      ffmpeg.on('error', reject);
      ffmpeg.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
    });

    // Read the combined file
    const combinedBuffer = await import('fs/promises').then(
      fs => fs.readFile(outputFile)
    );

    return combinedBuffer;
  } finally {
    // Clean up temporary files
    const filesToDelete = [...inputFiles, inputListFile, outputFile];
    await Promise.all(
      filesToDelete.map(file => 
        unlink(file).catch(() => {/* ignore cleanup errors */})
      )
    );
  }
}

// Main speech generation function that handles chunking
export async function generateSpeech(
  text: string,
  metadata: {
    title: string;
    episodeNumber: number;
    description?: string;
    subtitle?: string;
  }
): Promise<{
  buffer: Buffer;
  validation: {
    isValid: boolean;
    metadata: any;
    errors: string[];
    warnings: string[];
  };
}> {
  const chunks = chunkText(text);
  const audioBuffers: Buffer[] = [];

  // Process chunks sequentially
  for (const chunk of chunks) {
    const audioBuffer = await generateSpeechChunk(chunk);
    audioBuffers.push(audioBuffer);
  }

  // Combine audio chunks or use single chunk
  const combinedBuffer = audioBuffers.length === 1 
    ? audioBuffers[0] 
    : await combineAudioBuffers(audioBuffers, metadata);

  // Create a temporary file for validation
  const tempDir = "/tmp";
  const tempFile = join(tempDir, `temp_${randomUUID()}.mp3`);
  await writeFile(tempFile, combinedBuffer);

  try {
    // Import validation functions
    const { validatePodcastAudio, fixAudioIssues } = await import('./audio-validation');

    // Validate the audio
    const validation = await validatePodcastAudio(tempFile);
    console.log('Audio validation results:', validation);

    // If there are issues, attempt to fix them
    if (!validation.isValid) {
      console.log('Attempting to fix audio issues...');
      const fixedPath = await fixAudioIssues(tempFile, validation);
      
      // Read the fixed file if it's different from the temp file
      if (fixedPath !== tempFile) {
        const fixedBuffer = await readFile(fixedPath);
        await unlink(fixedPath); // Clean up fixed file
        await unlink(tempFile);  // Clean up temp file
        
        // Validate the fixed audio
        const fixedValidation = await validatePodcastAudio(fixedPath);
        return { 
          buffer: fixedBuffer,
          validation: fixedValidation
        };
      }
    }

    // Return original buffer with validation results
    return { 
      buffer: combinedBuffer,
      validation
    };
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempFile);
    } catch (error) {
      console.error('Error cleaning up temporary file:', error);
    }
  }
}