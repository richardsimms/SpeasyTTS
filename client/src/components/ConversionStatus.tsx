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
        "p-4 rounded-lg transition-colors cursor-pointer",
        isSelected ? "bg-accent" : "hover:bg-accent/80",
        article.status === "completed" ? "cursor-pointer" : "cursor-default",
      )}
      onClick={() => article.status === "completed" && onSelect?.()}
    >
      <div className="flex-1 mr-2">
        {article.ogImageUrl && (
          <div className="mb-2">
            <img
              src={article.ogImageUrl}
              alt={article.title}
              className="w-full h-84 object-cover rounded-md"
            />
          </div>
        )}
        <h3 className="font-medium text-ellipsis overflow-hidden">
          {article.title}
        </h3>
        {article.ogDescription && (
          <p className="text-sm text-muted-foreground mt-1">
            {article.ogDescription}
          </p>
        )}
      </div>
      <Progress
        value={getProgress(article.status)}
        className="h-1 m-4 w-fill"
      />
      <div className="flex justify-between">
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

      {article.status === "failed" && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-md">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {article.metadata?.error || "An error occurred during processing"}
          </p>
          
          {/* Enhanced error details */}
          {article.metadata?.error?.includes('paywall') && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              This article appears to be behind a paywall. Please try:
              <ul className="list-disc list-inside mt-1 ml-2">
                <li>Using a different source for the article</li>
                <li>Checking if a public version is available</li>
                <li>Using the direct text input method instead</li>
              </ul>
            </p>
          )}
          
          {article.metadata?.error?.includes('authentication') && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              This content requires authentication. Consider:
              <ul className="list-disc list-inside mt-1 ml-2">
                <li>Using a publicly accessible URL</li>
                <li>Finding an alternative source</li>
                <li>Copy-pasting the content directly</li>
              </ul>
            </p>
          )}
          
          {article.metadata?.validationErrors?.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Validation Errors:</p>
              <ul className="mt-1 text-sm text-red-500 dark:text-red-400 list-disc list-inside">
                {article.metadata.validationErrors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
