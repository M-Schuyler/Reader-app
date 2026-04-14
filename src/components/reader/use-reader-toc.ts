"use client";

import { useEffect, useState } from "react";

export type TocItem = {
  id: string;
  level: number;
  text: string;
};

export function useReaderToc(contentHtml: string) {
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !contentHtml) {
      setToc([]);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const headers = doc.querySelectorAll("h1, h2, h3");
    
    const items: TocItem[] = Array.from(headers).map((header, index) => {
      const level = parseInt(header.tagName.substring(1), 10);
      const text = header.textContent?.trim() ?? "";
      // Create a stable ID based on text and index
      const id = `header-${index}-${text.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}`;
      return { id, level, text };
    });

    setToc(items);
  }, [contentHtml]);

  return toc;
}

export function useScrollSpy(toc: TocItem[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0% -70% 0%", // Trigger when header is in the upper part of the screen
        threshold: 0,
      }
    );

    toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [toc]);

  return activeId;
}
