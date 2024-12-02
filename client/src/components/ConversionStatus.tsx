import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteArticle } from "../lib/api";
import type { Article } from "../../../db/schema";
import { cn } from "@/lib/utils";

interface ConversionStatusProps {
  article: Article;
  onDelete?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function ConversionStatus({
  article,

  onDelete,
  isSelected,
  onSelect,
}: ConversionStatusProps) {
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  const getProgress = (status: string) => {
    switch (status) {
      case "completed":
        return 100;
      case "failed":
        return 100;
      case "processing":
        return 50;
      default:
        return 0;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteArticle(article.id);
      toast({
        title: "Success",
        description: "Article deleted successfully",
      });
      onDelete?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={cn(
        "p-2 rounded-lg transition-colors cursor-pointer",
        isSelected ? "bg-accent" : "hover:bg-accent/80",
        article.status === "completed" ? "cursor-pointer" : "cursor-default",
      )}
      onClick={() => article.status === "completed" && onSelect?.()}
    >
      <div className="flex-1">
        {article.ogImageUrl && (
          <div className="mb-4">
            <img
              src={article.ogImageUrl}
              alt={article.title}
              className="w-full h-84 object-cover rounded-md"
            />
          </div>
        )}
        <h3 className="font-bold p-2 text-lg text-ellipsis overflow-hidden">
          {article.title}
        </h3>
        {article.ogDescription && (
          <p className="text-sm p-2 text-muted-foreground mt-1">
            {article.ogDescription}
          </p>
        )}
      </div>
      <Progress
        value={getProgress(article.status)}
        className="h-1 m-4 w-auto rounded"
      />
      <div className="flex p-2 justify-between">
          <Badge className={getStatusColor(article.status)}>
            {article.status}
          </Badge>
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={article.status === "processing"}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete article</span>
          </Button>        
      </div>

      {article.status === "failed" && article.metadata?.error && (
        <div className="mt-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-sm font-medium text-destructive mb-2">Error Converting Article</p>
          
          {/* Enhanced error message formatting */}
          <div className="text-sm space-y-3">
            {article.metadata.error.split('\n').reduce((acc: JSX.Element[], line: string, index: number) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return acc;

              // Handle section headers
              if (trimmedLine.endsWith(':')) {
                acc.push(
                  <p key={`header-${index}`} className="font-medium text-destructive/90 mt-2">
                    {trimmedLine}
                  </p>
                );
                return acc;
              }

              // Handle bullet points
              if (trimmedLine.startsWith('•')) {
                acc.push(
                  <div key={`bullet-${index}`} className="flex items-start space-x-2 text-destructive/80">
                    <span>•</span>
                    <span>{trimmedLine.substring(1).trim()}</span>
                  </div>
                );
                return acc;
              }

              // Handle numbered steps
              if (trimmedLine.match(/^\d+\./)) {
                acc.push(
                  <div key={`step-${index}`} className="flex items-start space-x-2 ml-2 text-destructive/80">
                    <span className="font-medium">{trimmedLine.match(/^\d+\./)![0]}</span>
                    <span>{trimmedLine.replace(/^\d+\./, '').trim()}</span>
                  </div>
                );
                return acc;
              }

              // Handle suggestions section
              if (trimmedLine.toLowerCase().startsWith('suggestion')) {
                acc.push(
                  <div key={`suggestions-${index}`} className="bg-accent/20 p-2 rounded-md mt-2">
                    <p className="font-medium text-destructive/90 mb-1">Suggestions:</p>
                    <div className="space-y-1 text-destructive/80">
                      {trimmedLine.replace(/^suggestions:?\s*/i, '').split(',').map((suggestion, i) => (
                        <p key={`suggestion-${i}`} className="ml-2">• {suggestion.trim()}</p>
                      ))}
                    </div>
                  </div>
                );
                return acc;
              }

              // Regular text
              acc.push(
                <p key={`text-${index}`} className="text-destructive/90">
                  {trimmedLine}
                </p>
              );
              return acc;
            }, [])}
          </div>

          {/* Context-specific error handling */}
          {article.metadata.error.toLowerCase().includes('paywall') && (
            <div className="mt-3 p-2 bg-accent/20 rounded-md">
              <p className="text-sm font-medium text-destructive/90">Paywall Detected</p>
              <p className="text-sm text-destructive/80 mt-1">
                This article appears to be behind a paywall. Consider:
              </p>
              <ul className="list-disc ml-4 mt-1 text-sm text-destructive/80">
                <li>Using the direct text input method</li>
                <li>Finding a publicly accessible version</li>
                <li>Checking for cached or archived versions</li>
              </ul>
            </div>
          )}
          
          {article.metadata.error.toLowerCase().includes('authentication') && (
            <div className="mt-3 p-2 bg-accent/20 rounded-md">
              <p className="text-sm font-medium text-destructive/90">Authentication Required</p>
              <p className="text-sm text-destructive/80 mt-1">
                This content requires authentication. Try:
              </p>
              <ul className="list-disc ml-4 mt-1 text-sm text-destructive/80">
                <li>Using reader mode in your browser</li>
                <li>Copying the text directly</li>
                <li>Finding an alternative source</li>
              </ul>
            </div>
          )}

          {article.metadata.error.includes('rate-limiting') && (
            <div className="mt-3 p-2 bg-accent/20 rounded-md">
              <p className="text-sm font-medium text-destructive/90">Rate Limit Detected</p>
              <p className="text-sm text-destructive/80 mt-1">
                The website is temporarily blocking access. Try:
              </p>
              <ul className="list-disc ml-4 mt-1 text-sm text-destructive/80">
                <li>Waiting a few minutes before trying again</li>
                <li>Using the direct text input method</li>
                <li>Accessing from a different location</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
