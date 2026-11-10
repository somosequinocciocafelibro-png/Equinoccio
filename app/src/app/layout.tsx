import type { ReactNode } from "react";

export const metadata = { title: "Caja Equinoccio" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
