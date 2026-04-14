import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ReaderPreferencesScript } from "@/components/reader/reader-preferences-script";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reader App",
  description: "A personal reading system centered on documents.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html data-theme="light" data-theme-preference="system" lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <ReaderPreferencesScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
