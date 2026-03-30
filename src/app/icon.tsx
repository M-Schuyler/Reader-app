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
            width: 420,
            height: 420,
            borderRadius: 104,
            background:
              "linear-gradient(160deg, #141821 0%, #050607 45%, #0a0d13 100%)",
            border: "2px solid rgba(255,255,255,0.16)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.26), inset 0 -8px 16px rgba(0,0,0,0.44)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f5f7fb",
            fontFamily:
              "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 270,
            fontWeight: 900,
            lineHeight: 1,
            position: "relative",
            overflow: "hidden",
            textShadow:
              "0 1px 1px rgba(255,255,255,0.30), 0 -2px 2px rgba(0,0,0,0.72)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 34,
              width: 230,
              height: 48,
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              transform: "rotate(-14deg)",
            }}
          />
          R
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}