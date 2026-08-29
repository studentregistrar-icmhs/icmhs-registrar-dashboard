import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ICMHS Registrar Dashboard",
  description: "Live student population tracker for ICMHS Registrar's Office",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body style={{ margin: 0, background: "#EEF1EA" }}>{children}</body>
    </html>
  );
}
