export function ReaderPreferencesScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var storageValue = localStorage.getItem("reader-preferences");
              if (storageValue) {
                var parsed = JSON.parse(storageValue);
                if (parsed && parsed.state) {
                  var state = parsed.state;
                  var fontSizeMap = { small: "1rem", medium: "1.125rem", large: "1.25rem" };
                  var lineHeightMap = { compact: "1.75", comfortable: "2", loose: "2.2" };
                  
                  if (state.readerFontSize && fontSizeMap[state.readerFontSize]) {
                    document.documentElement.style.setProperty("--reader-font-size", fontSizeMap[state.readerFontSize]);
                  }
                  if (state.readerLineHeight && lineHeightMap[state.readerLineHeight]) {
                    document.documentElement.style.setProperty("--reader-line-height", lineHeightMap[state.readerLineHeight]);
                  }
                }
              }
            } catch (e) {}
          })();
        `,
      }}
      suppressHydrationWarning
    />
  );
}
