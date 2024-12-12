import { Article } from "../../db/schema";

const MAX_CONTENT_LENGTH = 25000; // Limit content length to ensure reliable TTS conversion

export async function convertArticle(input: { url?: string; content?: string }) {
  try {
    // Validate content length if direct text input is used
    if (input.content) {
      const contentLength = input.content.length;
      if (contentLength > MAX_CONTENT_LENGTH) {
        throw new Error(
          `Content length (${contentLength} characters) exceeds the maximum of ${MAX_CONTENT_LENGTH}.\n\n` +
          'Please try:\n' +
          '1. Using a shorter text\n' +
          '2. Splitting the content into smaller parts\n' +
          '3. Removing unnecessary sections'
        );
      }
    }

    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Article conversion error:', errorData);
      throw new Error(errorData.error || "Failed to convert article");
    }

    return response.json();
  } catch (error: any) {
    console.error('Article conversion error:', error);
    throw error;
  }
}

export async function getArticles(): Promise<Article[]> {
  const response = await fetch("/api/articles");
  if (!response.ok) {
    throw new Error("Failed to fetch articles");
  }
  return response.json();
}

export async function deleteArticle(id: number): Promise<void> {
  const response = await fetch(`/api/articles/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete article");
  }
}
