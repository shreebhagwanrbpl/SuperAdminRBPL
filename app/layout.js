import "./globals.css";
import { WebsiteProvider } from "./src/context/WebsiteContext";
import { TaskManagerProvider } from "./src/context/TaskManagerContext";
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
          <TaskManagerProvider>
            <LayoutWrapper>
              {children}
            </LayoutWrapper>

            <Toaster position="top-right" />
          </TaskManagerProvider>
        </WebsiteProvider>
      </body>
    </html>
  );
}