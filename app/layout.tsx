import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MERIDIAN — Self-Service Analytics & Reporting",
  description:
    "Ask questions in plain English or SQL, get instant visualizations, and compose live dashboards over an enterprise data warehouse. In-browser SQL engine; optional AI translation.",
};

export const viewport: Viewport = { themeColor: "#F6F7F9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
