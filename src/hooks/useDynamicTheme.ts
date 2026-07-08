import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


/**
 * Converts a hex color (#RRGGBB) to HSL string "H S% L%"
 */
function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Generates lighter/darker variants from a base HSL
 */
function generateAccentFromHSL(hsl: string, satShift: number, lightShift: number): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const h = parseInt(parts[1]);
  const s = Math.max(0, Math.min(100, parseInt(parts[2]) + satShift));
  const l = Math.max(0, Math.min(100, parseInt(parts[3]) + lightShift));
  return `${h} ${s}% ${l}%`;
}

export function useDynamicTheme() {

  const { data: settings } = useQuery({
    queryKey: ["system-settings-theme"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("primary_color, secondary_color, background_color, logo_url, favicon_url, app_name, app_short_name").limit(1).single();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    // Apply primary color
    if (settings.primary_color) {
      const primaryHSL = hexToHSL(settings.primary_color);
      if (primaryHSL) {
        root.style.setProperty("--primary", primaryHSL);
        root.style.setProperty("--ring", primaryHSL);
        root.style.setProperty("--sidebar-primary", primaryHSL);
        root.style.setProperty("--sidebar-ring", primaryHSL);
        root.style.setProperty("--accent", generateAccentFromHSL(primaryHSL, -20, 49));
        root.style.setProperty("--accent-foreground", generateAccentFromHSL(primaryHSL, 0, -10));
        root.style.setProperty("--sidebar-accent", generateAccentFromHSL(primaryHSL, -20, 50));
        root.style.setProperty("--sidebar-accent-foreground", generateAccentFromHSL(primaryHSL, 0, -10));
        root.style.setProperty("--info", generateAccentFromHSL(primaryHSL, 0, 10));
      }
    }

    // Apply background color
    if (settings.background_color) {
      const bgHSL = hexToHSL(settings.background_color);
      if (bgHSL) {
        root.style.setProperty("--background", bgHSL);
      }
    }

    // Apply favicon
    if (settings.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = settings.favicon_url;
      } else {
        const newLink = document.createElement("link");
        newLink.rel = "icon";
        newLink.href = settings.favicon_url;
        document.head.appendChild(newLink);
      }
    }

    // Apply secondary color
    if (settings.secondary_color) {
      const secHSL = hexToHSL(settings.secondary_color);
      if (secHSL) {
        root.style.setProperty("--secondary", generateAccentFromHSL(secHSL, -5, 30));
        root.style.setProperty("--secondary-foreground", generateAccentFromHSL(secHSL, 0, -20));
        root.style.setProperty("--muted", generateAccentFromHSL(secHSL, -5, 30));
        root.style.setProperty("--muted-foreground", secHSL);
        root.style.setProperty("--sidebar-foreground", generateAccentFromHSL(secHSL, 0, -10));
      }
    }

    // Apply page title
    if (settings.app_name) {
      document.title = settings.app_short_name || settings.app_name;
    }
  }, [settings]);

  return settings;
}
