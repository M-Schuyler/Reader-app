import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 430,
            height: 430,
            borderRadius: 999,
            background: "#f5f5f7",
            border: "2px solid rgba(0,0,0,0.08)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -8px 16px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0a0a0a",
            fontFamily:
              "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 300,
            fontWeight: 900,
            lineHeight: 1,
            paddingTop: 8,
          }}
        >
          R
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
