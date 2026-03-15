"use client";
import { Sun, Moon, Languages } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useT, type Lang } from "@/lib/i18n";

export function SettingsBar() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useT();

  return (
    <div
      className="
        fixed bottom-5 right-5 z-50
        flex items-center gap-1.5
        px-3 py-2
        rounded-2xl
        border border-dc
        bg-dc-card
        shadow-xl shadow-black/30
        backdrop-blur-sm
      "
      style={{ transition: "background 0.2s, border-color 0.2s" }}
    >
      {/* Theme toggle */}
      <span className="text-xs text-dc-muted mr-1 select-none hidden sm:inline">
        {t("settings.theme")}
      </span>
      <button
        onClick={() => setTheme("dark")}
        title={t("settings.dark")}
        className={`
          flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium
          transition-all duration-150
          ${theme === "dark"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-dc-muted hover:text-dc hover:bg-dc-input"}
        `}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("settings.dark")}</span>
      </button>
      <button
        onClick={() => setTheme("light")}
        title={t("settings.light")}
        className={`
          flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium
          transition-all duration-150
          ${theme === "light"
            ? "bg-amber-500 text-white shadow-md"
            : "text-dc-muted hover:text-dc hover:bg-dc-input"}
        `}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("settings.light")}</span>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-dc-border mx-1" />

      {/* Language toggle */}
      <Languages className="w-3.5 h-3.5 text-dc-muted hidden sm:inline" />
      {(["it", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={l === "it" ? "Italiano" : "English"}
          className={`
            px-2.5 py-1.5 rounded-xl text-xs font-semibold uppercase
            transition-all duration-150
            ${lang === l
              ? "bg-emerald-600 text-white shadow-md"
              : "text-dc-muted hover:text-dc hover:bg-dc-input"}
          `}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
