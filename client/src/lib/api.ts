import { Article } from "../../db/schema";

export async function convertArticle(input: { url?: string; content?: string }) {
  const response = await fetch("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to convert article");
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
