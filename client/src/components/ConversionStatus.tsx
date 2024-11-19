import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Article } from "../../../db/schema";

interface ConversionStatusProps {
  article: Article;
}

export default function ConversionStatus({ article }: ConversionStatusProps) {
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

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium truncate">{article.title}</h3>
        <Badge className={getStatusColor(article.status)}>
          {article.status}
        </Badge>
      </div>
      
      <Progress value={getProgress(article.status)} className="h-1" />
      
      {article.status === "failed" && article.metadata?.error && (
        <p className="text-sm text-red-500 mt-1">
          {article.metadata.error}
        </p>
      )}
    </div>
  );
}
