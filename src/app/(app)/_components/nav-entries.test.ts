import { BarChart3, Home } from "lucide-react";
import { describe, expect, it } from "vitest";
import { type NavEntry, resolveNavEntry } from "./nav-entries";

const LINK: NavEntry = {
  icon: Home,
  label: "Inicio",
  href: "/",
  isActive: (path) => path === "/",
  shortcut: ["⌘", "H"],
};

const COMING_SOON: NavEntry = {
  icon: BarChart3,
  label: "Horarios",
  disabled: true,
  hint: "pronto",
};

const PREVIEW: NavEntry = {
  icon: BarChart3,
  label: "Dashboard",
  disabled: true,
  hint: "pronto",
  preview: {
    href: "/dashboard",
    isActive: (path) => path.startsWith("/dashboard"),
  },
};

describe("resolveNavEntry", () => {
  it("resolves a regular entry to an active link on its own route", () => {
    expect(resolveNavEntry(LINK, false, "/")).toEqual({
      disabled: false,
      icon: Home,
      label: "Inicio",
      href: "/",
      active: true,
      shortcut: ["⌘", "H"],
    });
  });

  it("resolves a regular entry to an inactive link elsewhere, whatever the previews flag", () => {
    const resolved = resolveNavEntry(LINK, true, "/notebooks");

    expect(resolved).toMatchObject({ disabled: false, active: false });
  });

  it("keeps a coming-soon entry disabled even when previews are enabled", () => {
    expect(resolveNavEntry(COMING_SOON, true, "/")).toEqual({
      disabled: true,
      icon: BarChart3,
      label: "Horarios",
      hint: "pronto",
    });
  });

  it("links a preview entry when previews are enabled", () => {
    expect(resolveNavEntry(PREVIEW, true, "/dashboard/semana")).toEqual({
      disabled: false,
      icon: BarChart3,
      label: "Dashboard",
      href: "/dashboard",
      active: true,
      shortcut: undefined,
    });
  });

  it("renders a preview entry as a disabled 'pronto' row when previews are disabled", () => {
    expect(resolveNavEntry(PREVIEW, false, "/dashboard")).toEqual({
      disabled: true,
      icon: BarChart3,
      label: "Dashboard",
      hint: "pronto",
    });
  });
});
