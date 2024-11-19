import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSpeech(text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
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
