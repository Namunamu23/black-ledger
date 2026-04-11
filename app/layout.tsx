import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Black Ledger",
  description: "Premium physical case files with digital bureau access.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white antialiased">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}