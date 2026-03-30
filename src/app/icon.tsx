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
          background:
            "radial-gradient(circle at 50% 20%, #f2f2f4 0%, #d9dade 45%, #bec1c8 100%)",
        }}
      >
        <div
          style={{
            width: 448,
            height: 448,
            borderRadius: 108,
            background:
              "linear-gradient(160deg, #15171d 0%, #050608 40%, #07080c 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f5f5f6",
            fontFamily:
              "Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 290,
            fontWeight: 900,
            lineHeight: 1,
            paddingTop: 8,
            position: "relative",
            border: "2px solid rgba(255,255,255,0.14)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.24), inset 0 -10px 18px rgba(0,0,0,0.45), 0 22px 28px rgba(0,0,0,0.28)",
            overflow: "hidden",
            textShadow:
              "0 2px 1px rgba(255,255,255,0.22), 0 -2px 1px rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 24% 16%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 45%), radial-gradient(circle at 82% 85%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 44%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 26,
              width: 248,
              height: 54,
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
