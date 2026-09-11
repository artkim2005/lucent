import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BiasIndicator } from "@/components/ui/bias-indicator";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BiasLabel, SentimentLabel } from "@/lib/supabase/types";

export interface NewsCardProps {
  href: string;
  title: string;
  sourceName: string;
  category?: string;
  country?: string;
  publishedAgo: string;
  sentimentLabel: SentimentLabel;
  biasLabel: BiasLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  confidence?: number;
  imageUrl?: string;
  className?: string;
}

const sentimentVariant = {
  positive: "accent",
  neutral: "neutral",
  negative: "destructive",
} as const;

const sentimentText = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
} as const;

const biasText = {
  left: "Left-leaning",
  center: "Center",
  right: "Right-leaning",
  mixed: "Mixed",
  unclear: "Unclear",
} as const;

export function NewsCard({
  href,
  title,
  sourceName,
  category,
  country,
  publishedAgo,
  sentimentLabel,
  biasLabel,
  leftPercentage,
  centerPercentage,
  rightPercentage,
  confidence,
  imageUrl,
  className,
}: NewsCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-base"
    >
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden transition-colors hover:border-violet/40",
          className,
        )}
      >
        <div
          className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-violet/25 via-elevated to-surface"
          style={
            imageUrl
              ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          <span className="absolute left-3 top-3 rounded-md bg-base/60 px-2 py-1 text-caption font-medium text-text backdrop-blur-sm">
            {country ? `${sourceName} · ${country}` : sourceName}
          </span>
          {!imageUrl && (
            <span className="text-caption text-subtle">Article image</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="text-caption text-subtle">
            {category ? `${category} · ${publishedAgo}` : publishedAgo}
          </p>

          <h3 className="text-h3 font-semibold text-text line-clamp-2">{title}</h3>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sentimentVariant[sentimentLabel]}>
              {sentimentText[sentimentLabel]}
            </Badge>
            <span className="text-caption text-subtle">{biasText[biasLabel]}</span>
          </div>

          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            <p className="text-caption text-subtle">AI-estimated framing</p>
            <BiasIndicator
              leftPercentage={leftPercentage}
              centerPercentage={centerPercentage}
              rightPercentage={rightPercentage}
            />
            {confidence !== undefined && (
              <p className="text-caption text-subtle">
                {Math.round(confidence * 100)}% confidence
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
