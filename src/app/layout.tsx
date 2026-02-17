import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL("https://imagevote-production.up.railway.app"),
  title: "Dormy",
  description: "Help shape the future of smart charging!",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ImageVote",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Dormy",
    description: "Help shape the future of smart charging!",
    images: [{ url: "/og-image.png", width: 1024, height: 1024 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
