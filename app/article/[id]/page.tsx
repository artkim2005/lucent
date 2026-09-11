import { Bookmark, Share2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsCard } from "@/components/news-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { BiasIndicator } from "@/components/ui/bias-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublishedArticleById, getRelatedArticles } from "@/lib/supabase/queries/articles";
import { formatRelativeTime } from "@/lib/utils";

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

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getPublishedArticleById(id);

  if (!article) {
    notFound();
  }

  const analysis = article.article_analyses;
  const bodyParagraphs = article.raw_text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  // Related Articles (AGENTS.md section 20): only shown when this article
  // has an embedding -- absent for not-yet-backfilled legacy analyses.
  const relatedArticles = analysis.embedding
    ? await getRelatedArticles(article.id, analysis.embedding)
    : [];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8">
        <Link
          href="/"
          className="w-fit text-body-s font-medium text-violet underline underline-offset-4 hover:text-violet/80"
        >
          ← Back to Home
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <article className="flex flex-col gap-6 lg:col-span-2">
            <div className="flex flex-col gap-3">
              <h1 className="text-h1 font-bold text-text">{article.title}</h1>

              <div className="flex flex-wrap items-center gap-3">
                <p className="text-body-s text-subtle">
                  {formatRelativeTime(article.published_at)}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="icon" aria-label="Bookmark article">
                    <Bookmark className="size-4" strokeWidth={1.6} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Share article">
                    <Share2 className="size-4" strokeWidth={1.6} />
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet/25 via-elevated to-surface"
              style={{
                backgroundImage: `url(${article.image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="absolute left-3 top-3 rounded-md bg-base/60 px-2 py-1 text-caption font-medium text-text backdrop-blur-sm">
                {article.sources.name}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {bodyParagraphs.map((paragraph, index) => (
                <p key={index} className="text-body-l text-text">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>

          <aside className="flex flex-col gap-6">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-h3 font-semibold text-text">Bias Analysis</h2>

              <div className="flex items-center gap-2">
                <span className="text-caption text-subtle">Overall framing:</span>
                <span className="text-body-s font-semibold text-text">
                  {biasText[analysis.bias_label]}
                </span>
              </div>

              <BiasIndicator
                leftPercentage={analysis.left_percentage}
                centerPercentage={analysis.center_percentage}
                rightPercentage={analysis.right_percentage}
              />

              <p className="text-caption text-subtle">
                {Math.round(analysis.confidence * 100)}% confidence
              </p>

              <p className="text-caption text-subtle">
                AI-estimated framing based on the article&apos;s text, not an objective
                measure.
              </p>
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-h3 font-semibold text-text">AI Summary</h2>
                <Badge variant={sentimentVariant[analysis.sentiment_label]}>
                  {sentimentText[analysis.sentiment_label]}
                </Badge>
              </div>

              <p className="text-body-s text-text">{analysis.summary}</p>

              {analysis.framing_notes && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-caption font-semibold uppercase tracking-wider text-subtle">
                    Framing Notes
                  </p>
                  <p className="text-body-s text-subtle">{analysis.framing_notes}</p>
                </div>
              )}

              {analysis.loaded_terms.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-caption font-semibold uppercase tracking-wider text-subtle">
                    Loaded Terms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.loaded_terms.map((term) => (
                      <Badge key={term} variant="neutral">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-caption text-subtle">{analysis.disclaimer}</p>
            </Card>
          </aside>
        </div>

        {relatedArticles.length > 0 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-h2 font-semibold text-text">Related Articles</h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <NewsCard
                  key={related.id}
                  href={`/article/${related.id}`}
                  title={related.title}
                  sourceName={related.sourceName}
                  publishedAgo={formatRelativeTime(related.publishedAt)}
                  imageUrl={related.imageUrl}
                  sentimentLabel={related.sentimentLabel}
                  biasLabel={related.biasLabel}
                  leftPercentage={related.leftPercentage}
                  centerPercentage={related.centerPercentage}
                  rightPercentage={related.rightPercentage}
                  confidence={related.confidence}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
