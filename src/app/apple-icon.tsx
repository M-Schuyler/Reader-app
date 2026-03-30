import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          borderRadius: 40,
          color: "#ffffff",
          fontFamily:
            "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: 120,
          fontWeight: 800,
          lineHeight: 1,
          paddingTop: 2,
        }}
      >
        R
      </div>
    ),
    {
      ...size,
    }
  );
}
