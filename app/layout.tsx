import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent yh Prototype",
  description: "LINE/Yahoo public API based personal daily agent prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
