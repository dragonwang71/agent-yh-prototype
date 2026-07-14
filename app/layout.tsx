import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent yh | Everyday decision agent",
  description:
    "A source-grounded everyday agent for shopping and weather-aware local recommendations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
