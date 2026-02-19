import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "COIStack — Insurance Compliance on Autopilot",
    template: "%s — COIStack",
  },
  description:
    "Automated COI compliance management for property managers. Upload certificates, extract data with AI, score compliance instantly.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://coistack.com"),
  keywords: [
    "COI tracking",
    "certificate of insurance",
    "COI compliance",
    "insurance compliance software",
    "vendor insurance management",
    "property management insurance",
    "COI automation",
    "vendor compliance",
    "insurance document management",
    "COI management software",
  ],
  openGraph: {
    type: "website",
    siteName: "COIStack",
    title: "COIStack — Insurance Compliance on Autopilot",
    description:
      "Automated COI compliance management for property managers. Upload certificates, extract data with AI, score compliance instantly.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "COIStack — Insurance Compliance on Autopilot",
    description:
      "Automated COI compliance management for property managers. Upload certificates, extract data with AI, score compliance instantly.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
