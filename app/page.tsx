import { NewsCard } from "@/components/news-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedArticlesForHomepage } from "@/lib/supabase/queries/articles";
import { formatRelativeTime } from "@/lib/utils";

export default async function Home() {
  const articles = await getPublishedArticlesForHomepage();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-6 py-8">
        <h2 className="text-h2 font-semibold text-text">Top News</h2>

        {articles.length === 0 ? (
          <p className="py-16 text-center text-body-s text-subtle">
            No analyzed articles yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <NewsCard
                key={article.id}
                href={`/article/${article.id}`}
                title={article.title}
                sourceName={article.sources.name}
                publishedAgo={formatRelativeTime(article.published_at)}
                imageUrl={article.image_url}
                sentimentLabel={article.article_analyses.sentiment_label}
                biasLabel={article.article_analyses.bias_label}
                leftPercentage={article.article_analyses.left_percentage}
                centerPercentage={article.article_analyses.center_percentage}
                rightPercentage={article.article_analyses.right_percentage}
                confidence={article.article_analyses.confidence}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
