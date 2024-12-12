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

      {article.status === "failed" && (article.metadata?.error || article.error) && (
        <div className="mt-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-sm font-medium text-destructive mb-1">Error Converting Article</p>
          <p className="text-sm text-destructive/90">{article.metadata?.error || article.error}</p>
          
          {/* Enhanced error handling with more specific tips */}
          {article.metadata.error.includes('paywall') && (
            <p className="text-sm text-muted-foreground mt-2">
              Tip: This content is behind a paywall. You can:
              <ul className="list-disc ml-4 mt-1">
                <li>Use the direct text input method instead</li>
                <li>Find a publicly accessible version of this article</li>
                <li>Try a different article from a non-paywalled source</li>
              </ul>
            </p>
          )}
          {article.metadata.error.includes('authentication') && (
            <p className="text-sm text-muted-foreground mt-2">
              Tip: This content requires authentication. You can:
              <ul className="list-disc ml-4 mt-1">
                <li>Use the direct text input method</li>
                <li>Find a public version of the article</li>
                <li>Make sure you're using a publicly accessible URL</li>
              </ul>
            </p>
          )}
          {article.metadata.error.includes('URL') && (
            <p className="text-sm text-muted-foreground mt-2">
              Tip: Please check that:
              <ul className="list-disc ml-4 mt-1">
                <li>The URL starts with http:// or https://</li>
                <li>The website is accessible</li>
                <li>There are no typos in the URL</li>
              </ul>
            </p>
          )}
          {article.metadata.error.includes('content type') && (
            <p className="text-sm text-muted-foreground mt-2">
              Tip: This URL doesn't point to a readable article. Make sure:
              <ul className="list-disc ml-4 mt-1">
                <li>The URL points to an actual article page</li>
                <li>The content is in HTML format</li>
                <li>You're not linking to a PDF or other file type</li>
              </ul>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
