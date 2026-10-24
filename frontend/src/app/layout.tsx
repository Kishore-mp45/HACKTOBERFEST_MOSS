import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Moss — The Digital Backlog Gardener",
    template: "%s — Moss",
  },
  description:
    "Moss is a local-first, open-source AI agent that understands your documents, connects related information, surfaces forgotten tasks, and organizes your digital workspace — with every change reviewed and approved by you.",
  keywords: [
    "Moss",
    "digital backlog gardener",
    "local-first AI",
    "document organization",
    "open-weight models",
    "file management",
    "open source",
  ],
  authors: [{ name: "Moss contributors" }],
  icons: {
    icon: "/moss-icon.svg",
  },
  openGraph: {
    title: "Moss — The Digital Backlog Gardener",
    description:
      "Let your digital garden grow. Moss will handle the clutter — local AI that organizes your documents with you in control.",
    siteName: "Moss",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Moss — The Digital Backlog Gardener",
    description:
      "Local-first AI that understands your files, connects scattered information, and organizes your digital workspace — with you in control.",
  },
};

export const viewport: Viewport = {
  themeColor: "#203D32",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
