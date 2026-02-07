import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImageVote",
  description: "Simple image evaluation and A/B testing tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
