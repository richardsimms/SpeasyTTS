import { useEffect } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import ArticleInput from "../components/ArticleInput";
import AudioPlayer from "../components/AudioPlayer";
import ConversionStatus from "../components/ConversionStatus";
import { getArticles } from "../lib/api";

export default function Dashboard() {
  const { data: articles, mutate } = useSWR("/api/articles", getArticles);

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
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Speasy</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                  <div key={article.id} className="mb-4">
                    <ConversionStatus article={article} />
                    {article.audioUrl && (
                      <AudioPlayer
                        title={article.title}
                        audioUrl={article.audioUrl}
                      />
                    )}
                  </div>
                ))}
              </ScrollArea>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
            {articles?.find((a) => a.audioUrl) && (
              <AudioPlayer
                title={articles.find((a) => a.audioUrl)!.title}
                audioUrl={articles.find((a) => a.audioUrl)!.audioUrl!}
                showWaveform
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
