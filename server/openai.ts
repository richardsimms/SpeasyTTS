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
    model: "tts-1",
    voice: "alloy",
    input: text,
  });

  return Buffer.from(await response.arrayBuffer());
}

// Combine audio buffers using FFmpeg
async function combineAudioBuffers(audioBuffers: Buffer[]): Promise<Buffer> {
  const tempDir = "/tmp";
  const sessionId = randomUUID();
  const inputFiles: string[] = [];
  const inputListFile = join(tempDir, `${sessionId}_list.txt`);
  const outputFile = join(tempDir, `${sessionId}_output.mp3`);

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

    // Combine audio files using FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', inputListFile,
        '-c', 'copy',
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
export async function generateSpeech(text: string): Promise<{
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
    : await combineAudioBuffers(audioBuffers);

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

// Extract the main content from HTML
function extractMainContent(document: Document): string {
  // Common content selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    'main',
    '#content',
    '.content'
  ];

  let content = '';
  
  // Try each selector until we find content
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      if (content.length > 100) { // Ensure we have substantial content
        break;
      }
    }
  }

  // Fallback: if no content found, try <p> tags in the body
  if (!content || content.length < 100) {
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent)
      .filter(text => text && text.length > 50) // Filter out short paragraphs
      .join('\n\n');
    
    if (paragraphs.length > content.length) {
      content = paragraphs;
    }
  }

  return cleanText(content);
}

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

    const html = await response.text();
    const dom = new JSDOM(html);
    const { document } = dom.window;

    // Extract title
    const title = 
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      document.querySelector('h1')?.textContent ||
      document.title ||
      'Untitled Article';

    // Extract content
    const content = extractMainContent(document);

    if (!content || content.length < 100) {
      throw new Error('Could not extract meaningful content from the article');
    }

    return {
      title: cleanText(title),
      content
    };
  } catch (error: any) {
    throw new Error(`Article extraction failed: ${error.message}`);
  }
}
