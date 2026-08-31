"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Twitter,
  Play,
  Bot,
  Lightbulb,
  Flower2,
  FileText,
  ClipboardList,
  HeartPulse,
  Cpu,
  Workflow,
  Menu,
  X,
  Github,
  Server,
  Notebook,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

import { Logo } from "./logo";

const navGroups = [
  {
    name: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/hermes", label: "Hermes", icon: Cpu },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
    ],
  },
  {
    name: "Content",
    items: [
      { href: "/x", label: "X", icon: Twitter },
      { href: "/content-os", label: "Pipeline", icon: Workflow },
      { href: "/articles", label: "Articles", icon: FileText },
      { href: "/youtube", label: "YouTube", icon: Play },
      { href: "/github", label: "GitHub", icon: Github },
    ],
  },
  {
    name: "Data",
    items: [
      { href: "/client-pulse", label: "Client Pulse", icon: HeartPulse },
    ],
  },
  {
    name: "System",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/homelab", label: "Homelab", icon: Server },
      { href: "/memory-wiki", label: "Memory Wiki", icon: Notebook },
      { href: "/ideas", label: "Ideas", icon: Lightbulb },
      { href: "/garden", label: "Garden", icon: Flower2 },
    ],
  },
];

const mobileTabsRaw = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/x", label: "X", icon: Twitter },
  { href: "/github", label: "GitHub", icon: Github },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/agents", label: "Agents", icon: Bot },
  {
    href: "#",
    label: "Search",
    icon: Search,
    action: true,
  },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const [showSearchHint, setShowSearchHint] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("hermy_search_hint_dismissed");
      setShowSearchHint(!dismissed);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const frame = requestAnimationFrame(() => setIsOpen(false));
      return () => cancelAnimationFrame(frame);
    }
  }, [pathname, setIsOpen]);

  const dismissSearchHint = () => {
    setShowSearchHint(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("hermy_search_hint_dismissed", "1");
    }
  };

  return (
    <>
      {/* Mobile/tablet header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
        <Logo isOpen={isOpen} />
        <div className="flex items-center gap-1">
          <div className="relative">
            {showSearchHint && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] text-[var(--text-2)] shadow-lg">
                Search &middot; ⌘K
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-[var(--surface-2)] border-r border-b border-[var(--line)]" />
              </div>
            )}
            <button
              onClick={() => {
                dismissSearchHint();
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-command-palette"));
                }
              }}
              className={`p-2 text-[var(--text-2)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-[var(--surface-1)] ${showSearchHint ? "animate-pulse" : ""}`}
              aria-label="Search, or ask Hermes…"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-[var(--text-2)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-[var(--surface-1)]"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile/tablet bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-t border-[var(--line)] px-2 py-2 safe-area-pb">
        <nav className="flex justify-around">
          {mobileTabsRaw.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            if (item.action) {
              return (
                <div key="search" className="relative">
                  {showSearchHint && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] text-[var(--text-2)] shadow-lg">
                      Search &middot; ⌘K
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-[var(--surface-2)] border-r border-b border-[var(--line)]" />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      dismissSearchHint();
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("open-command-palette"));
                      }
                    }}
                    className={`flex flex-col items-center gap-1 p-2 px-3 rounded-lg transition-all active:scale-95 ${
                      isActive
                        ? "text-[var(--text)] bg-[var(--surface-2)]"
                        : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                    } ${showSearchHint ? "animate-pulse" : ""}`}
                    aria-label="Search, or ask Hermes…"
                    title="Search"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 px-3 rounded-lg transition-all ${
                  isActive
                    ? "text-[var(--text)] bg-[var(--surface-2)]"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)] active:scale-95"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile/tablet overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 md:z-10
          ${isOpen ? "w-64 md:w-[15rem]" : "w-0 md:w-14"} h-full
          bg-[var(--bg)] md:bg-transparent border-r ${isOpen ? "border-[var(--line)]" : "border-none"}
          flex flex-col
          transition-all duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          top-0 left-0
          ${!isOpen ? "overflow-hidden" : ""}
        `}
      >
        <div className={`hidden md:flex transition-all duration-300 ease-out relative ${isOpen ? "flex-row px-4 pt-5 pb-5" : "flex-col items-center px-0 pt-5 pb-5"} bg-gradient-to-b from-white/[0.035] via-white/[0.012] to-transparent border-b border-[var(--line)]/60 z-10`}>
          <Logo isOpen={isOpen} />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`md:flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-1)] transition-all duration-200 ease-out ${isOpen ? "ml-auto mr-1 mt-0.5" : "mt-10"}`}
            aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          {!isOpen && (
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-command-palette"));
                }
              }}
              className="mt-4 flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-1)] transition-all duration-200 ease-out relative group"
              aria-label="Open command palette"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
              <span className="absolute left-14 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-2)] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Search
              </span>
            </button>
          )}
        </div>

        <div className="h-16 lg:hidden" />

        <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${isOpen ? "px-3" : "px-0"}`}>
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.name}>
                <h3 className={`eyebrow px-3 mb-1.5 !text-[10px] !text-[var(--text-4)] transition-all duration-300 ${isOpen ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden mb-0"}`}>
                  {group.name}
                </h3>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center transition-all duration-300 rounded-[10px] py-[7px] ${
                          isOpen 
                            ? "px-3 gap-3" 
                            : "px-0 justify-center w-10 mx-auto"
                        } ${
                          isActive
                            ? "bg-[var(--surface-2)] text-[var(--text)]"
                            : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]"
                        }`}
                      >
                        {isActive && (
                          <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--accent)] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} />
                        )}
                        <div className={`flex items-center justify-center transition-all duration-300 ${!isOpen ? "w-6 h-6" : "w-auto h-auto"}`}>
                          <Icon
                            className={`w-[17px] h-[17px] shrink-0 transition-all duration-300 ${
                              isActive ? "text-[var(--text)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]"
                            } ${!isOpen ? "scale-110" : ""}`}
                          />
                        </div>
                        <span className={`text-[13.5px] font-medium transition-all duration-300 ${isOpen ? "opacity-100 w-auto ml-0" : "opacity-0 w-0 overflow-hidden pointer-events-none"}`}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className={`px-4 py-4 border-t border-[var(--line)] transition-all duration-300 ${isOpen ? "" : "px-0 flex justify-center"}`}>
          <div className={`flex items-center gap-2 text-[var(--text-3)] text-[11.5px] transition-all duration-300 ${isOpen ? "" : "justify-center"}`}>
            <span className="relative flex w-1.5 h-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--up)] opacity-60 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--up)]" />
            </span>
            <span className={`transition-all duration-300 ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden pointer-events-none"}`}>
              All systems online
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}