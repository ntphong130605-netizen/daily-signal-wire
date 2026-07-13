"use client";

import { useEffect, useState } from "react";

export default function ReaderThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("dsw-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = saved ? saved === "dark" : prefersDark;
    setDark(shouldUseDark);
    document.documentElement.dataset.theme = shouldUseDark ? "dark" : "light";
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("dsw-theme", next ? "dark" : "light");
  }

  return (
    <button
      className="reader-theme-toggle"
      onClick={toggle}
      type="button"
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      aria-pressed={dark}
    >
      <span>{dark ? "☾" : "☼"}</span>
      {dark ? "Dark" : "Light"}
    </button>
  );
}
