import { type Article } from "../db/schema";
import { type AudioMetadata } from "./routes";

export function generateRssFeed(articles: Article[]): string {
  const publicUrl =
    process.env.PUBLIC_URL?.replace(/\/$/, "") ||
    "https://speasy.replit.app/public/audio/";
  const now = new Date().toUTCString();

  const podcastItems = articles
    .filter((article) => article.status === "completed" && article.audioUrl)
    .map((article) => {
      // Format publication date
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : now;

      // Parse metadata
      const metadata = article.metadata as AudioMetadata;

      // Format duration as HH:MM:SS
      const duration = metadata?.duration || 0;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      const formattedDuration = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      // Ensure full URL for audio files
      const fullAudioUrl = article.audioUrl?.startsWith("http")
        ? article.audioUrl
        : `${publicUrl}${article.audioUrl}`;

      return `
        <item>
          <title>${escapeXml(article.podcastTitle || article.title)}</title>
          <description>${escapeXml(article.podcastDescription || article.content.substring(0, 400) + "...")}</description>
          <pubDate>${pubDate}</pubDate>
          <guid isPermaLink="false">${publicUrl}/api/articles/${article.id}</guid>
          <enclosure 
            url="${escapeXml(fullAudioUrl)}" 
            type="audio/mpeg" 
            length="${metadata?.contentLength || 0}"
          />
          <itunes:duration>${formattedDuration}</itunes:duration>
          <itunes:summary>${escapeXml(article.podcastDescription || article.content.substring(0, 400) + "...")}</itunes:summary>
          <itunes:explicit>no</itunes:explicit>
          ${article.episodeNumber ? `<itunes:episode>${article.episodeNumber}</itunes:episode>` : ""}
        </item>
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Speasy</title>
    <link>${publicUrl}</link>
    <description>Automatically converted articles to audio format</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <itunes:author>Article to Audio</itunes:author>
    <itunes:summary>Listen to your favorite articles as audio content</itunes:summary>
    <itunes:category text="Technology"/>
    <itunes:explicit>no</itunes:explicit>
    ${podcastItems}
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
