import "./globals.css";
import { WebsiteProvider } from "./src/context/WebsiteContext"; 
import Sidebar  from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
export const metadata = {
  title: "Multi Admin Panel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WebsiteProvider>
         <Sidebar /> 
          {children}
          <Toaster position="top-right" />
        </WebsiteProvider>
      </body>
    </html>
  );
}