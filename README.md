
# Speasy TTS - Article to Audio Converter

Speasy TTS is a web application that converts articles into audio format using OpenAI's Text-to-Speech API. It provides an easy way to listen to articles while multitasking.

## Features

- Convert web articles to audio using OpenAI's TTS
- RSS feed support for podcast apps
- Clean article extraction from web pages
- Progress tracking for conversions
- Audio player with playback controls
- Mobile-responsive design

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 16
- OpenAI API key

## Setup

1. Fork this Repl in Replit
2. Add your OpenAI API key to the Secrets tab (Environment variables):
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

3. Install dependencies:
```bash
npm install
```

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `https://your-repl-name.your-username.repl.co`

## Usage

1. Navigate to the application URL
2. Paste an article URL into the input field
3. Click "Convert to Audio"
4. Wait for the conversion to complete
5. Use the audio player to listen to the article

## RSS Feed

An RSS feed of your converted articles is available at `/api/feed.xml`. You can add this URL to your podcast app to listen to your articles on the go.

## Tech Stack

- React
- TypeScript
- Express
- PostgreSQL
- OpenAI API
- Tailwind CSS
- ShadcnUI
- Drizzle ORM

## Development

The project structure:
- `/client` - React frontend
- `/server` - Express backend
- `/db` - Database schema and configuration
- `/public` - Static assets
