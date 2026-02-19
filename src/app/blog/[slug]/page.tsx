import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getPostBySlug, getBlogSlugs, getRelatedPosts } from "@/lib/blog";

export async function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };

  const titleText = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  // Use absolute title when seoTitle is provided (it already includes branding)
  const title = post.seoTitle ? { absolute: post.seoTitle } : titleText;

  return {
    title,
    description,
    openGraph: {
      title: titleText,
      description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      url: `/blog/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description,
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, post.tags, 2);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coistack.com";
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "COIStack",
      url: baseUrl,
    },
    datePublished: post.publishedAt,
    url: `${baseUrl}/blog/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <MarketingNav />
      <main className="py-12 sm:py-16">
        <article className="mx-auto max-w-3xl px-4 lg:px-6">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Blog
          </Link>

          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{post.author}</span>
            <span>&middot;</span>
            <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
            <span>&middot;</span>
            <span>{post.readTime} min read</span>
          </div>

          <div className="prose prose-green dark:prose-invert mt-8 max-w-none">
            <MDXRemote source={post.content} />
          </div>
        </article>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mx-auto mt-16 max-w-3xl px-4 lg:px-6">
            <h2 className="font-serif text-2xl font-semibold">Related Posts</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {r.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mx-auto mt-16 max-w-3xl px-4 text-center lg:px-6">
          <div className="rounded-lg bg-primary/5 p-8">
            <h2 className="font-serif text-2xl font-semibold">
              Ready to automate your COI compliance?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Start your free 14-day trial. No credit card required.
            </p>
            <Button className="mt-4 gap-2" asChild>
              <Link href="/auth/register">
                Start Free Trial
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
