import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://imagevote-production.up.railway.app"),
  title: "Dormy",
  description: "Help shape the future of smart charging!",
  openGraph: {
    title: "Dormy",
    description: "Help shape the future of smart charging!",
    images: [{ url: "/og-image.png", width: 1024, height: 1024 }],
  },
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
