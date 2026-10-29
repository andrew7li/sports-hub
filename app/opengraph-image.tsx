import { ImageResponse } from "next/og";

export const alt = "SportsHub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same mark as app/favicon.ico and app/components/Logo.tsx — one accent
// color per sport this hub covers, ascending left to right.
const BARS = [
  { color: "#0ea5e9", height: 0.38 },
  { color: "#f97316", height: 0.64 },
  { color: "#10b981", height: 0.9 },
];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "#0f2140",
        padding: "80px 96px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: 24,
          background: "#0a1730",
          marginBottom: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 11,
            paddingBottom: 20,
          }}
        >
          {BARS.map((bar, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: Math.round(80 * bar.height),
                background: bar.color,
                borderRadius: 5,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 88,
          fontWeight: 700,
          color: "#f3f7fc",
          lineHeight: 1,
        }}
      >
        SportsHub
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontSize: 32,
          color: "#9fb3cc",
        }}
      >
        Helping sports lovers make money.
      </div>
    </div>,
    { ...size },
  );
}
