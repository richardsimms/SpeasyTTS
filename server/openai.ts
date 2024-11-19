import OpenAI from "openai";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
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
        i === 0 ? 'w' : 'a'
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
export async function generateSpeech(text: string): Promise<Buffer> {
  const chunks = chunkText(text);
  const audioBuffers: Buffer[] = [];

  // Process chunks sequentially
  for (const chunk of chunks) {
    const audioBuffer = await generateSpeechChunk(chunk);
    audioBuffers.push(audioBuffer);
  }

  // If only one chunk, return it directly
  if (audioBuffers.length === 1) {
    return audioBuffers[0];
  }

  // Combine audio chunks using FFmpeg
  return await combineAudioBuffers(audioBuffers);
}

export async function extractArticle(url: string): Promise<{
  title: string;
  content: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Extract and clean the main content from the given article URL. Return JSON with title and content.",
      },
      {
        role: "user",
        content: `Extract content from: ${url}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}
