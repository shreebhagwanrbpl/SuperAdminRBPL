import "./globals.css";
import { WebsiteProvider } from "./src/context/WebsiteContext";
import { Toaster } from "react-hot-toast";
import LayoutWrapper from "./components/LayoutWrapper";

export const metadata = {
  title: "Multi Admin Panel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WebsiteProvider>

          <LayoutWrapper>
            {children}
          </LayoutWrapper>

          <Toaster position="top-right" />

        </WebsiteProvider>
      </body>
    </html>
  );
}