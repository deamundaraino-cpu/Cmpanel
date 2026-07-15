"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/icons";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem("bp-theme", next);
    } catch {
      // almacenamiento no disponible
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-100"
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[17px] w-[17px] text-zinc-500" />
      {theme === "dark" ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}
