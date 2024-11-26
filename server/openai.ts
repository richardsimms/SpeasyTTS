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
    // Fetch the webpage with proper headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('This article requires authentication. Please try a publicly accessible URL.');
      } else if (response.status === 403) {
        throw new Error('Access to this article is forbidden. The website might be blocking automated access.');
      } else if (response.status === 404) {
        throw new Error('Article not found. Please check if the URL is correct.');
      } else {
        throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
      }
    }

    // Get and clean HTML content
    let html = await response.text();
    html = cleanHtml(html);

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const { document } = dom.window;

    // Use Readability to extract the main content
    const reader = new Readability(document, {
      charThreshold: 100,
      classesToPreserve: ['article', 'content'],
      keepClasses: true
    });
    
    const article = reader.parse();
    
    if (!article) {
      throw new Error('Failed to parse article content');
    }

    // Extract metadata
    const metaTags = {
      title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
             document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
      description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                  document.querySelector('meta[name="description"]')?.getAttribute('content'),
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') ||
              document.querySelector('meta[property="article:author"]')?.getAttribute('content')
    };

    // Get the final title
    const title = metaTags.title || article.title || document.title || 'Untitled Article';

    // Convert HTML to Markdown
    const turndownService = createCustomTurndownService();
    const markdown = turndownService.turndown(article.content);

    // Validate content
    if (!markdown || markdown.length < 100) {
      throw new Error('Could not extract meaningful content from the article');
    }

    // Format the content with metadata
    const formattedContent = [
      `# ${title}`,
      metaTags.author ? `\nAuthor: ${metaTags.author}` : '',
      metaTags.description ? `\n> ${metaTags.description}\n` : '\n',
      markdown
    ].filter(Boolean).join('\n');

    return {
      title: cleanText(title),
      content: cleanText(formattedContent)
    };
  } catch (error: any) {
    // Enhanced error handling
    let errorMessage = 'Article extraction failed';
    
    if (error instanceof TypeError) {
      errorMessage = 'Invalid HTML structure or network error';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Could not connect to the website';
    } else if (error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Connection timed out';
    } else if (error.message.includes('SSL')) {
      errorMessage = 'SSL/TLS error occurred';
    }
    
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}
