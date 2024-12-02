import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
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

  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="mx-auto max-w-[700px] p-6 pb-24">
        <div className="flex justify-between items-center mb-8">
          <svg 
            xmlns="http://www.w3.org/2000/svg"
            width="140"
            height="56"
            viewBox="0 0 340 120"
            version="1.2"
          >
            <path fill-rule="evenodd" clip-rule="evenodd" d="M6.25702 35.294C7.6403 35.6157 9.31309 35.7766 11.2754 35.7766C14.1063 35.7766 16.5672 35.2779 18.6582 34.2807C20.7653 33.2674 22.3979 31.9726 23.556 30.3963C24.7301 28.82 25.3172 27.1794 25.3172 25.4744C25.3172 24.3163 24.899 23.2467 24.0626 22.2656C23.2262 21.2683 22.1164 20.255 20.7331 19.2256L15.0874 15.0516C14.042 14.2795 13.2297 13.604 12.6507 13.025C12.0877 12.4459 11.8062 11.8106 11.8062 11.119C11.8062 10.3791 12.152 9.63113 12.8436 8.87513C13.5514 8.11917 14.5003 7.4195 15.6906 6.77611C16.8165 6.16489 17.9987 5.68234 19.2373 5.32851C20.4758 4.97464 21.5936 4.79771 22.5909 4.79771C22.9448 4.79771 23.2423 4.854 23.4836 4.96661C23.7409 5.07919 23.8696 5.32044 23.8696 5.69041C23.8696 6.07644 23.6846 6.47853 23.3147 6.89676C22.9608 7.29885 22.5507 7.62056 22.0842 7.86181C21.4891 8.18353 21.0548 8.56956 20.7814 9.0199C20.524 9.47029 20.3953 9.92064 20.3953 10.371C20.3953 10.9018 20.5562 11.3682 20.8779 11.7704C21.1996 12.1564 21.6339 12.3494 22.1807 12.3494C22.7115 12.3494 23.2906 12.1323 23.9179 11.698C26.7166 9.81609 28.1159 7.64469 28.1159 5.18374C28.1159 3.52703 27.5852 2.32873 26.5236 1.58884C25.4781 0.84895 24.1672 0.479004 22.5909 0.479004C21.0628 0.479004 19.3981 0.784612 17.5966 1.39582C15.7952 1.99095 14.0983 2.81126 12.5059 3.85676C10.9135 4.91835 9.61064 6.1247 8.59732 7.47578C7.58401 8.81081 7.07734 10.2021 7.07734 11.6497C7.07734 12.7113 7.37492 13.7327 7.97004 14.7138C8.56516 15.695 9.4659 16.7164 10.6722 17.7779L12.4576 19.1773C12.9241 19.5472 13.5031 19.9735 14.1948 20.456C14.9025 20.9386 15.7228 21.4854 16.6557 22.0966C17.7012 22.7722 18.4652 23.4236 18.9477 24.0509C19.4303 24.6782 19.6715 25.2814 19.6715 25.8604C19.6715 26.8898 19.2936 27.8147 18.5376 28.635C17.7816 29.4392 16.7763 30.0746 15.5217 30.541C14.2832 31.0075 12.9241 31.2407 11.4443 31.2407C9.30506 31.2407 7.76095 30.9914 6.81195 30.4928C5.87902 29.9781 5.41257 29.3829 5.41257 28.7074C5.41257 28.1766 5.66992 27.6458 6.18463 27.115C6.69934 26.5682 7.40708 26.1017 8.30781 25.7157C9.11203 25.3779 9.62674 25.0803 9.85193 24.823C10.0771 24.5495 10.1897 24.1796 10.1897 23.7132C10.1897 23.2306 10.0771 22.8044 9.85193 22.4344C9.64284 22.0484 9.30506 21.8554 8.83858 21.8554C7.58401 22.161 6.43395 22.6033 5.38844 23.1823C4.35903 23.7614 3.46635 24.4209 2.71038 25.1607C1.13409 26.7049 0.345947 28.3053 0.345947 29.962C0.345947 30.7341 0.547002 31.474 0.949119 32.1817C1.35123 32.8733 1.99461 33.4845 2.87927 34.0153C3.76391 34.5622 4.88984 34.9884 6.25702 35.294Z" fill="text-foreground fill-current" />
          </svg>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-200 dark:absolute dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <ArticleInput onConvert={() => mutate()} />
            <h2 className="text-xl font-semibold mb-4 mt-12 text-foreground">
              Recent Conversions
            </h2>

            {articles?.map((article) => (
              <Card key={article.id} className="mt-6">
                <ConversionStatus
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
