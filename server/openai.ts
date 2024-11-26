import OpenAI from "openai";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to chunk text into segments under 4000 characters
function chunkText(text: string): string[] {
  const MAX_CHUNK_SIZE = 4000;
  const chunks: string[] = [];
  let currentChunk = "";

  // Split text into sentences (basic splitting at periods followed by spaces)
  const sentences = text.split(/(?<=\.|\?|\!)\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= MAX_CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Generate speech for a single chunk
async function generateSpeechChunk(text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",  // Use HD model for better quality
    voice: "alloy",     // Keep consistent voice
    input: text,
    response_format: "mp3",
    speed: 1.0
  });

  return Buffer.from(await response.arrayBuffer());
}

// Helper function to sanitize title for filenames
function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
    .substring(0, 100);       // Limit length
}

// Helper function to generate standardized filename
export function generatePodcastFilename(episodeNumber: number, title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedTitle = sanitizeTitle(title);
  return `${date}-episode-${episodeNumber}-${sanitizedTitle}.mp3`;
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

import { JSDOM } from 'jsdom';

// Clean HTML text content
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .replace(/\n+/g, '\n')          // Replace multiple newlines with single newline
    .trim();                        // Remove leading/trailing whitespace
}

import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Utility function to clean and format HTML content
function cleanHtml(html: string): string {
  // Remove script and style tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline styles and event handlers
  html = html.replace(/ style="[^"]*"/g, '');
  html = html.replace(/ on\w+="[^"]*"/g, '');
  
  // Remove comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  return html.trim();
}

// Custom TurndownService configuration
function createCustomTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_'
  });

  // Preserve line breaks
  turndownService.addRule('lineBreaks', {
    filter: ['br'],
    replacement: () => '\n'
  });

  // Better handling of lists
  turndownService.addRule('listItems', {
    filter: ['li'],
    replacement: function(content, node, options) {
      content = content
        .replace(/^\n+/, '') // Remove leading newlines
        .replace(/\n+$/, '') // Remove trailing newlines
        .replace(/\n/gm, '\n    '); // Indent wrapped lines
      
      const prefix = options.bulletListMarker + ' ';
      const parent = node.parentNode;
      const index = Array.prototype.indexOf.call(parent.children, node) + 1;
      
      return (
        prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
      );
    }
  });

  return turndownService;
}

// Enhanced content extraction
export async function extractArticle(url: string): Promise<{
  title: string;
  content: string;
}> {
  try {
    // Configure fetch headers for better compatibility
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1',
      'Upgrade-Insecure-Requests': '1'
    };

    // Fetch with timeout and retry logic
    const fetchWithTimeout = async (url: string, retries = 2) => {
      const timeout = 10000; // 10 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (retries > 0 && (error.name === 'AbortError' || error.message.includes('ETIMEDOUT'))) {
          return fetchWithTimeout(url, retries - 1);
        }
        throw error;
      }
    };

    const response = await fetchWithTimeout(url);

    // Enhanced error handling with specific messages
    if (!response.ok) {
      const errorMessages: { [key: number]: string } = {
        401: 'This article requires authentication. Please try a publicly accessible URL.',
        403: 'Access forbidden. The website might be blocking automated access. Try again later.',
        404: 'Article not found. Please check if the URL is correct.',
        429: 'Too many requests. Please wait a few minutes and try again.',
        500: 'Server error. The website might be experiencing issues.',
        503: 'Service unavailable. The website might be under maintenance.'
      };
      throw new Error(errorMessages[response.status] || 
        `Failed to fetch article: ${response.status} ${response.statusText}`);
    }

    // Get and sanitize HTML content
    const html = await response.text();
    const sanitizedHtml = html
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
      // Additional Readability options for better content detection
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
                  document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                  document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') ||
              document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
              document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content'),
      published: document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                document.querySelector('time[pubdate]')?.getAttribute('datetime')
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
      linkReferenceStyle: 'full',
      preformattedCode: true
    });

    // Add custom rules for better content preservation
    turndownService.addRule('paragraphSpacing', {
      filter: 'p',
      replacement: (content, node) => {
        return '\n\n' + content + '\n\n';
      }
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

    // Convert to Markdown with enhanced formatting
    const markdown = turndownService.turndown(article.content);

    // Validate content length and quality
    if (!markdown || markdown.length < 100) {
      throw new Error('Extracted content is too short or empty. The article might be paywalled or requires authentication.');
    }

    // Format the final content with metadata
    const formattedContent = [
      `# ${metaTags.title || article.title || document.title || 'Untitled Article'}`,
      metaTags.author ? `\nAuthor: ${metaTags.author}` : '',
      metaTags.published ? `\nPublished: ${new Date(metaTags.published).toLocaleString()}` : '',
      metaTags.description ? `\n> ${metaTags.description}\n` : '\n',
      markdown
    ].filter(Boolean).join('\n');

    // Clean and normalize the final output
    const normalizeText = (text: string) => {
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    return {
      title: normalizeText(metaTags.title || article.title || document.title || 'Untitled Article'),
      content: formattedContent
    };

  } catch (error: any) {
    // Enhanced error categorization and handling
    const errorMessages: { [key: string]: string } = {
      TypeError: 'Invalid HTML structure or network error',
      SyntaxError: 'Invalid HTML content',
      ECONNREFUSED: 'Could not connect to the website',
      ETIMEDOUT: 'Connection timed out',
      SSL: 'SSL/TLS error occurred',
      AbortError: 'Request timed out'
    };

    const errorType = Object.keys(errorMessages).find(type => 
      error instanceof Error && (
        error.name === type || 
        error.message.includes(type)
      )
    );

    const errorMessage = errorType 
      ? errorMessages[errorType] 
      : 'Article extraction failed';

    throw new Error(`${errorMessage}: ${error.message}`);
  }
}
