import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Insurance Compliance Insights",
  description:
    "Expert insights on COI compliance, vendor insurance management, and risk mitigation for property managers. Learn best practices for certificate of insurance tracking.",
  keywords: [
    "COI compliance blog",
    "insurance compliance articles",
    "vendor management tips",
    "property management insurance",
  ],
  openGraph: {
    title: "COIStack Blog — Insurance Compliance Insights",
    description:
      "Expert insights on COI compliance, vendor insurance management, and risk mitigation for property managers.",
    url: "/blog",
  },
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <MarketingNav />
      <main className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="text-center">
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
              Blog
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Insights on insurance compliance and risk management
            </p>
          </div>

          {posts.length === 0 ? (
            <p className="mt-12 text-center text-muted-foreground">
              No posts yet. Check back soon!
            </p>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <h2 className="mt-3 font-semibold leading-tight">
                        {post.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                        {post.excerpt}
                      </p>
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                        <span>&middot;</span>
                        <span>{post.readTime} min read</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
