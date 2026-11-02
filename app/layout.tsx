// Il layout vero (con <html lang>) è in app/[locale]/layout.tsx; questo serve solo a Next.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
