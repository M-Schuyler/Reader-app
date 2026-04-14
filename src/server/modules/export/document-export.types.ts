export type DocumentDownloadFormat = "markdown" | "html" | "obsidian";

export type BuiltDocumentDownload = {
  content: string;
  contentType: string;
  extension: "md" | "html";
};
