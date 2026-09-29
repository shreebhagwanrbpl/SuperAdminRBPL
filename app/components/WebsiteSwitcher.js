"use client";
import { websites } from "../data/dummyData";
import { useWebsite } from "../src/context/WebsiteContext";

export default function WebsiteSwitcher() {
  const { activeWebsite, setActiveWebsite } = useWebsite();

  return (
    <select
      className="border px-3 py-2 rounded"
      onChange={(e) =>
        setActiveWebsite(
          websites.find((w) => w.id === e.target.value)
        )
      }
    >
      <option>Select Website</option>
      {websites.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}