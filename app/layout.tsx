import "./globals.css";

export const metadata = {
  title: "Aljezur - Monte Clérigo T2",
  description: "Alojamento local em Aljezur, perto da Costa Vicentina",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
