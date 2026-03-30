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
          background:
            "linear-gradient(160deg, #161921 0%, #050608 45%, #090b10 100%)",
          borderRadius: 42,
          color: "#f4f4f5",
          fontFamily:
            "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: 115,
          fontWeight: 900,
          lineHeight: 1,
          paddingTop: 2,
          border: "1.5px solid rgba(255,255,255,0.16)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -5px 12px rgba(0,0,0,0.42)",
          position: "relative",
          overflow: "hidden",
          textShadow:
            "0 1px 1px rgba(255,255,255,0.22), 0 -1px 1px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 24% 14%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0) 48%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 7,
            left: 10,
            width: 86,
            height: 18,
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            transform: "rotate(-14deg)",
          }}
        />
        R
      </div>
    ),
    {
      ...size,
    }
  );
}
