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
              className="w-full h-64 object-cover rounded-md"
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
      <Progress value={getProgress(article.status)} className="h-1 m-4 w-fill" />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
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
      </div>


      {article.status === "failed" && article.metadata?.error && (
        <p className="text-sm text-red-500 mt-1">{article.metadata.error}</p>
      )}
    </div>
  );
}
