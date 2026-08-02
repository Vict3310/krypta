import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultMetadata: Metadata = {
  title: {
    default: "Krypta | AI-Powered Penetration Testing",
    template: "%s | Krypta",
  },
  description:
    "Krypta attacks so you don't have to. AI-powered penetration testing that actively tries to hack your site — SQL injection, XSS, auth bypass, privilege escalation.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://krypta.dev"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Krypta | AI-Powered Penetration Testing",
    description:
      "AI-powered penetration testing that actively tries to hack your site.",
    siteName: "Krypta",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Krypta AI Security Testing Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Krypta | AI-Powered Penetration Testing",
    description:
      "AI-powered penetration testing that actively tries to hack your site.",
    images: ["/og-image.png"],
    creator: "@krypta",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export async function generateMetadata({
  params,
}: {
  params?: Record<string, string>;
}): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krypta.dev";

  if (params?.id) {
    return {
      ...defaultMetadata,
      alternates: {
        canonical: `${siteUrl}/dashboard/scans/${params.id}`,
      },
      title: {
        default: "Scan Details | Krypta",
        template: "%s | Krypta",
      },
      openGraph: {
        ...defaultMetadata.openGraph,
        url: `${siteUrl}/dashboard/scans/${params.id}`,
      },
    };
  }

  return {
    ...defaultMetadata,
    alternates: {
      canonical: siteUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} scroll-smooth`}>
      <body
        className="antialiased bg-sf-bg-primary min-h-screen text-sf-text-primary selection:bg-sf-accent selection:text-white"
      >
        {/* Atmosphere blobs */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 sm:-right-40 sm:-top-40 h-[250px] w-[250px] sm:h-[400px] sm:w-[400px] md:h-[600px] md:w-[600px] rounded-full bg-gradient-to-bl from-sf-accent/12 to-transparent blur-2xl sm:blur-3xl opacity-40 sm:opacity-60" />
          <div className="absolute -bottom-20 -left-20 sm:-bottom-40 sm:-left-40 h-[200px] w-[200px] sm:h-[350px] sm:w-[350px] md:h-[500px] md:w-[500px] rounded-full bg-gradient-to-tr from-[#F05A3C]/10 to-transparent blur-2xl sm:blur-3xl opacity-30 sm:opacity-50" />
          <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] sm:h-[300px] sm:w-[300px] md:h-[400px] md:w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-sf-accent/5 to-transparent blur-xl sm:blur-3xl opacity-20 sm:opacity-40" />
        </div>

        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
