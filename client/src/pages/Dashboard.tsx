import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import ArticleInput from "../components/ArticleInput";
import AudioPlayer from "../components/AudioPlayer";
import ConversionStatus from "../components/ConversionStatus";
import { getArticles } from "../lib/api";
import type { Article } from "../../../db/schema";

export default function Dashboard() {
  const { data: articles, mutate } = useSWR("/api/articles", getArticles);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 5000);
    return () => clearInterval(interval);
  }, [mutate]);

  // Set first completed article as selected if none selected
  useEffect(() => {
    if (!selectedArticleId && articles?.length) {
      const firstCompletedArticle = articles.find(
        (a) => a.status === "completed" && a.audioUrl
      );
      if (firstCompletedArticle) {
        setSelectedArticleId(firstCompletedArticle.id);
      }
    }
  }, [articles, selectedArticleId]);

  const toggleTheme = () => {
    const html = document.documentElement;
    const currentTheme = html.classList.contains("dark") ? "light" : "dark";
    html.classList.remove("light", "dark");
    html.classList.add(currentTheme);
  };

  const selectedArticle = articles?.find((a) => a.id === selectedArticleId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white">Speasy</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 dark:text-white" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ArticleInput onConvert={() => mutate()} />
            <Card className="mt-6 p-4">
              <h2 className="text-xl font-semibold mb-4">Recent Conversions</h2>
              <ScrollArea className="h-[400px]">
                {articles?.map((article) => (
                  <ConversionStatus 
                    key={article.id}
                    article={article}
                    onDelete={() => {
                      if (selectedArticleId === article.id) {
                        setSelectedArticleId(null);
                      }
                      mutate();
                    }}
                    isSelected={article.id === selectedArticleId}
                    onSelect={() => setSelectedArticleId(article.id)}
                  />
                ))}
              </ScrollArea>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
            {selectedArticle?.audioUrl ? (
              <AudioPlayer
                title={selectedArticle.title}
                audioUrl={selectedArticle.audioUrl}
                showWaveform
              />
            ) : (
              <div className="text-center text-muted-foreground p-4">
                Select a completed article to play
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
