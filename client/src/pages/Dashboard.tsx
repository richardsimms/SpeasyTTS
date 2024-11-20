import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import ArticleInput from "../components/ArticleInput";
import ConversionStatus from "../components/ConversionStatus";
import AudioPlayerOverlay from "../components/AudioPlayerOverlay";
import { getArticles } from "../lib/api";
import type { Article } from "../../../db/schema";

export default function Dashboard() {
  const { data: articles, mutate } = useSWR("/api/articles", getArticles);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 5000);
    return () => clearInterval(interval);
  }, [mutate]);

  const toggleTheme = () => {
    const html = document.documentElement;
    const currentTheme = html.classList.contains("dark") ? "light" : "dark";
    html.classList.remove("light", "dark");
    html.classList.add(currentTheme);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto p-6 pb-24">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-foreground">
            Speasy
          </h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <ArticleInput onConvert={() => mutate()} />
              <h2 className="text-xl font-semibold mb-4 mt-12 text-foreground">Recent Conversions</h2>
              
                {articles?.map((article) => (
            <Card className="mt-6">
                  <ConversionStatus 
                    key={article.id}
                    article={article}
                    onDelete={() => mutate()}
                    isSelected={selectedArticle?.id === article.id}
                    onSelect={() => {
                      if (article.status === "completed" && article.audioUrl) {
                        setSelectedArticle(article);
                      }
                    }}
                  />
            </Card>
                ))}
              
          </div>
        </div>
      </div>

      {selectedArticle && selectedArticle.audioUrl && (
        <AudioPlayerOverlay
          title={selectedArticle.title}
          content={selectedArticle.content}
          audioUrl={selectedArticle.audioUrl}
        />
      )}
    </div>
  );
}
