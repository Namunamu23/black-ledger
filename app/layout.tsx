import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Black Ledger",
  description: "Premium investigative entertainment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white">
        <Navbar />
        {children}
      </body>
    </html>
  );
}