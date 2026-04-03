export type DocumentDownloadFormat = "markdown" | "html";

export type BuiltDocumentDownload = {
  content: string;
  contentType: string;
  extension: "md" | "html";
};
