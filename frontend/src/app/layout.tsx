import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowEasy CRM - AI CSV Importer",
  description: "Map arbitrary CSV records into GrowEasy CRM schema using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
