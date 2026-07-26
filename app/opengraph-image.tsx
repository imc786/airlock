import { ImageResponse } from "next/og";

export const alt = "Airlock - the golden pnpm 11 CI template";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <svg width="104" height="104" viewBox="0 0 24 24" fill="#3fb950">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
          />
        </svg>
        <div style={{ fontSize: "104px", fontWeight: 700 }}>Airlock</div>
      </div>
      <div style={{ marginTop: "36px", fontSize: "38px", color: "#8b949e", maxWidth: "920px" }}>
        The golden pnpm 11 + Dependabot + audit-fix CI template for solo Next.js on Vercel.
      </div>
    </div>,
    size,
  );
}
