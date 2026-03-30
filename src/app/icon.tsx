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
            width: 448,
            height: 448,
            borderRadius: 96,
            background: "#050505",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontFamily:
              "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 300,
            fontWeight: 800,
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
