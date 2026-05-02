    "use client";
import { createContext, useContext, useState } from "react";

const WebsiteContext = createContext();

export const WebsiteProvider = ({ children }) => {
  const [activeWebsite, setActiveWebsite] = useState(null);

  return (
    <WebsiteContext.Provider value={{ activeWebsite, setActiveWebsite }}>
      {children}
    </WebsiteContext.Provider>
  );
};

export const useWebsite = () => useContext(WebsiteContext);