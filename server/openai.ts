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
  
  // First, split into paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    if (paragraph.length <= MAX_CHUNK_SIZE) {
      // If paragraph fits in a chunk, add it
      chunks.push(paragraph.trim());
    } else {
      // Split paragraph into sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let currentChunk = "";
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        
        if (trimmedSentence.length > MAX_CHUNK_SIZE) {
          // Handle very long sentences by splitting at natural breaks
          const parts = trimmedSentence.split(/(?<=,|\sand\s|\sor\s|\sbut\s|\;)\s+/);
          for (const part of parts) {
            if (part.length <= MAX_CHUNK_SIZE) {
              chunks.push(part.trim());
            } else {
              // If still too long, split by words
              const words = part.split(/\s+/);
              let wordChunk = "";
              for (const word of words) {
                if ((wordChunk + " " + word).length <= MAX_CHUNK_SIZE) {
                  wordChunk += (wordChunk ? " " : "") + word;
                } else {
                  if (wordChunk.length >= MIN_CHUNK_SIZE) {
                    chunks.push(wordChunk.trim());
                  }
                  wordChunk = word;
                }
              }
              if (wordChunk.length >= MIN_CHUNK_SIZE) {
                chunks.push(wordChunk.trim());
              }
            }
          }
        } else if ((currentChunk + " " + trimmedSentence).length <= MAX_CHUNK_SIZE) {
          // Add to current chunk
          currentChunk += (currentChunk ? " " : "") + trimmedSentence;
        } else {
          // Start new chunk
          if (currentChunk.length >= MIN_CHUNK_SIZE) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = trimmedSentence;
        }
      }
      
      // Add remaining chunk
      if (currentChunk.length >= MIN_CHUNK_SIZE) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  
  return chunks.filter(chunk => chunk.length >= MIN_CHUNK_SIZE);
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

// Enhanced content extraction with JSDOM and better error handling
export async function extractArticle(url: string): Promise<ExtractedMetadata> {
  try {
    console.log('Fetching content from URL:', url);
    
    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML with enhanced JSDOM configuration
    const dom = new JSDOM(html, {
      url: url,
      contentType: "text/html",
      pretendToBeVisual: true,
      resources: "usable"
    });

    // Check for authentication redirects
    const finalUrl = response.url.toLowerCase();
    if (finalUrl.includes('login') || finalUrl.includes('signin') || finalUrl.includes('auth')) {
      throw new Error(
        'This content requires authentication. Please try one of these methods:\n' +
        '1. Wait a few minutes and try again (if rate-limited)\n' +
        '2. Copy the article text and use the direct text input method\n' +
        '3. Find the original article URL instead of the web-share link'
      );
    }

    // Check for error messages in the content
    const document = dom.window.document;
    const bodyText = document.body.textContent || '';
    const errorPatterns = [
      'Access Denied',
      'Login Required',
      'Authentication Required',
      'Please sign in',
      'Subscribe to continue',
      'Premium content'
    ];

    if (errorPatterns.some(pattern => bodyText.includes(pattern))) {
      throw new Error(
        'Access to this content is restricted. Please try:\n' +
        '1. Using the direct text input method\n' +
        '2. Finding the original article URL\n' +
        '3. Ensuring you have proper access rights'
      );
    }

    // Clean up the DOM before extraction
    const scripts = document.getElementsByTagName('script');
    const styles = document.getElementsByTagName('style');
    Array.from(scripts).forEach(script => script.remove());
    Array.from(styles).forEach(style => style.remove());

    // Configure Readability with enhanced options
    const reader = new Readability(document, {
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

    // Extract OpenGraph metadata with prioritized sources
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

    return {
      title: metaTags.title || article.title || document.title || 'Untitled Article',
      content: formattedContent,
      ogDescription: ogDescription ? ogDescription.trim() : undefined,
      ogDescriptionSource,
      ogImageUrl
    };
  } catch (error: any) {
    console.error('Article extraction error:', error);
    
    // Enhanced error categorization for specific error types
    const errorMessages: { [key: string]: string } = {
      TypeError: 'Invalid HTML structure or network error',
      SyntaxError: 'Invalid HTML content',
      TimeoutError: 'Page load timed out. This could mean:\n' +
                   '1. The website is blocking automated access\n' +
                   '2. The connection is slow\n' +
                   '3. The page requires authentication\n\n' +
                   'Please try using the direct text input method instead.',
      WebError: 'Failed to load the webpage',
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
    const combinedBuffer = await readFile(outputFile);
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
    const { validatePodcastAudio } = await import('./audio-validation');

    // Validate the audio
    const validation = await validatePodcastAudio(tempFile);
    console.log('Audio validation results:', validation);

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