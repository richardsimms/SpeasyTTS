import { type Article } from "../db/schema";
import { type AudioMetadata } from "./routes";
import Showdown from 'showdown';

// Configure Showdown converter with podcast-friendly options
const converter = new Showdown.Converter({
  simpleLineBreaks: true,
  strikethrough: true,
  tables: true,
  tasklists: true,
  metadata: true,
  openLinksInNewWindow: true,
  emoji: true,
  parseImgDimensions: true,
  smoothLivePreview: true
});

// Add markdown styling options
converter.setOption('simpleLineBreaks', true);
converter.setOption('parseMetadata', true);

// URL configuration object to centralize all URL handling
const CONFIG = {
  // Base URL for the application
  getBaseUrl: () => {
    return (
      process.env.PUBLIC_URL?.replace(/\/$/, "") || "https://speasy.replit.app"
    );
  },

  // Specific URL generators
  urls: {
    audio: (path?: string) => {
      if (!path) return `${CONFIG.getBaseUrl()}/public/audio`;
      
      // Remove any leading/trailing slashes and normalize path
      const normalizedPath = path
        .replace(/^[\/\\]+/, '') // Remove leading slashes
        .replace(/[\/\\]+$/, '') // Remove trailing slashes
        .replace(/[\/\\]+/g, '/'); // Replace multiple slashes with single slash
      
      // If path already contains 'public/audio', don't add it again
      if (normalizedPath.startsWith('public/audio/') || normalizedPath.startsWith('/public/audio/')) {
        return `${CONFIG.getBaseUrl()}/${normalizedPath.replace(/^\//, '')}`;
      }
      
      if (normalizedPath.startsWith('audio/')) {
        return `${CONFIG.getBaseUrl()}/public/${normalizedPath}`;
      }
      
      return `${CONFIG.getBaseUrl()}/public/audio/${normalizedPath}`;
    },
    article: (id: string) => `${CONFIG.getBaseUrl()}/api/articles/${id}`,
    feed: () => `${CONFIG.getBaseUrl()}/feed.xml`,
    cover: () => `${CONFIG.getBaseUrl()}/public/images/podcast-cover.jpg`,
  },
};

export function generateRssFeed(articles: Article[]): string {
  const now = new Date().toUTCString();

  const podcastItems = articles
    .filter((article) => article.status === "completed" && article.audioUrl)
    .map((article) => {
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : now;

      const metadata = article.metadata as AudioMetadata;

      // Format duration as HH:MM:SS
      const duration = metadata?.duration || 0;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      const formattedDuration = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      // Handle audio URL construction
      const fullAudioUrl = article.audioUrl?.startsWith("http")
        ? article.audioUrl
        : CONFIG.urls.audio(article.audioUrl);

      // Create a rich HTML description with the full article content
      // Convert markdown content to HTML
      const convertedHtml = converter.makeHtml(article.content);
      const htmlDescription = `
        <div class="podcast-content">
          <h1>${article.podcastTitle || article.title}</h1>
          ${convertedHtml}
          ${
            article.url
              ? `<p><a href="${article.url}" target="_blank" rel="noopener">Read original article</a></p>`
              : ""
          }
        </div>
      `;

      return `
        <item>
          <title><![CDATA[${article.podcastTitle || article.title}]]></title>
          <link>${CONFIG.urls.article(article.id)}</link>
          <guid isPermaLink="false">${CONFIG.urls.article(article.id)}</guid>

          <description><![CDATA[${article.ogDescription || htmlDescription}]]></description>
          <content:encoded><![CDATA[${htmlDescription}]]></content:encoded>

          <pubDate>${pubDate}</pubDate>

          <enclosure 
            url="${escapeXml(fullAudioUrl)}" 
            type="audio/mpeg" 
            length="${metadata?.contentLength || 0}"
          />

          <itunes:title><![CDATA[${article.podcastTitle || article.title}]]></itunes:title>
          <itunes:duration>${formattedDuration}</itunes:duration>
          <itunes:summary><![CDATA[${
            article.podcastDescription ||
            article.content.substring(0, 400) + "..."
          }]]></itunes:summary>
          <itunes:explicit>no</itunes:explicit>
          ${
            article.episodeNumber
              ? `<itunes:episode>${article.episodeNumber}</itunes:episode>`
              : ""
          }
          ${
            article.author
              ? `<itunes:author><![CDATA[${article.author}]]></itunes:author>`
              : ""
          }
          ${
            article.imageUrl
              ? `<itunes:image href="${escapeXml(article.imageUrl)}"/>`
              : ""
          }
        </item>
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Speasy</title>
    <link>${CONFIG.getBaseUrl()}</link>
    <description><![CDATA[Automatically converted articles to audio format]]></description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>Speasy RSS Generator</generator>

    <itunes:author>Article to Audio</itunes:author>
    <itunes:summary><![CDATA[Listen to your favorite articles as audio content]]></itunes:summary>
    <itunes:category text="Technology"/>
    <itunes:explicit>no</itunes:explicit>
    <itunes:owner>
      <itunes:name>Speasy</itunes:name>
      <itunes:email>contact@speasy.com</itunes:email>
    </itunes:owner>

    <image>
      <url>${CONFIG.urls.cover()}</url>
      <title>Speasy</title>
      <link>${CONFIG.getBaseUrl()}</link>
    </image>
    <itunes:image href="${CONFIG.urls.cover()}"/>

    <atom:link href="${CONFIG.urls.feed()}" rel="self" type="application/rss+xml"/>

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
