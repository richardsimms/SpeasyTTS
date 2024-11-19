import { Article } from "../db/schema";

export function generateRssFeed(articles: Article[]): string {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:5000`;
  const now = new Date().toUTCString();
  
  const podcastItems = articles
    .filter(article => article.status === "completed" && article.audioUrl)
    .map(article => {
      const pubDate = article.publishedAt ? new Date(article.publishedAt).toUTCString() : now;
      return `
        <item>
          <title>${escapeXml(article.podcastTitle || article.title)}</title>
          <description>${escapeXml(article.podcastDescription || article.content.substring(0, 400) + '...')}</description>
          <pubDate>${pubDate}</pubDate>
          <guid isPermaLink="false">${publicUrl}/api/articles/${article.id}</guid>
          <enclosure url="${article.audioUrl}" type="audio/mpeg" length="0"/>
          <itunes:duration>00:00:00</itunes:duration>
          <itunes:summary>${escapeXml(article.podcastDescription || article.content.substring(0, 400) + '...')}</itunes:summary>
          <itunes:explicit>no</itunes:explicit>
          ${article.episodeNumber ? `<itunes:episode>${article.episodeNumber}</itunes:episode>` : ''}
        </item>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Article to Audio Podcast</title>
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
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
