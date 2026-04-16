import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cyber Threat Map // 8200 Demo",
  description: "Real-time cyber threat visualization — built by AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
        style={{ backgroundColor: "#030712", color: "#fafafa", margin: 0, overflow: "hidden" }}
      >
        {children}
      </body>
    </html>
  );
}
