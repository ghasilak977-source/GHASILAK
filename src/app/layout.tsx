import type { ReactNode } from "react";

/**
 * Root layout is a passthrough so locale layouts can own <html>/<body>
 * (lang + dir for AR/EN).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
