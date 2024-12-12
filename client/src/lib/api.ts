import { Article } from "../../db/schema";

const MAX_CONTENT_LENGTH = 100000; // Reasonable limit for article length

export async function convertArticle(input: { url?: string; content?: string }) {
  // Validate content length if direct text input is used
  if (input.content && input.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Article content is too long. Maximum allowed length is ${MAX_CONTENT_LENGTH} characters.`);
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
