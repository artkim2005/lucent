import { Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ArticleCardProps {
  sourceName: string;
  sourceCountry: string;
  category: string;
  publishedAgo: string;
  title: string;
  description: string;
  imageUrl?: string;
  onReadNow?: () => void;
  onSave?: () => void;
  onBookmark?: () => void;
  className?: string;
}

export function ArticleCard({
  sourceName,
  sourceCountry,
  category,
  publishedAgo,
  title,
  description,
  imageUrl,
  onReadNow,
  onSave,
  onBookmark,
  className,
}: ArticleCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div
        className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-violet/25 via-elevated to-surface"
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <span className="absolute left-3 top-3 rounded-md bg-base/60 px-2 py-1 text-caption font-medium text-text backdrop-blur-sm">
          {sourceName} · {sourceCountry}
        </span>
        {!imageUrl && (
          <span className="text-caption text-subtle">Article image</span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{category}</Badge>
          <span className="text-caption text-subtle">{publishedAgo}</span>
        </div>

        <h3 className="text-h3 font-semibold text-text line-clamp-2">{title}</h3>

        <p className="text-body-s text-subtle line-clamp-2">{description}</p>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" onClick={onReadNow}>
            Read now
          </Button>
          <Button variant="secondary" onClick={onSave}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Bookmark article"
            onClick={onBookmark}
          >
            <Bookmark className="size-4" strokeWidth={1.6} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
