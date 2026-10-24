"use client";

import * as React from "react";
import { Github, Menu, X } from "lucide-react";
import { MossLogo } from "@/components/moss/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { Link, useRouter } from "@/lib/router";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "privacy", label: "Privacy" },
  { id: "open-source", label: "Open Source" },
] as const;

/**
 * Smooth-scrolls to a landing section. Works from any route: if the landing
 * page is not mounted yet it first navigates to `/`, then scrolls.
 */
export function useSectionScroll() {
  const { path, navigate } = useRouter();
  return React.useCallback(
    (sectionId: string) => {
      const scroll = () => {
        window.requestAnimationFrame(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      };
      if (path !== "/") {
        navigate("/");
        window.setTimeout(scroll, 90);
      } else {
        scroll();
      }
    },
    [path, navigate],
  );
}

export function SectionScrollLink({
  sectionId,
  className,
  children,
}: {
  sectionId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const scroll = useSectionScroll();
  return (
    <button
      type="button"
      onClick={() => scroll(sectionId)}
      className={cn(
        "rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors",
        scrolled ? "border-border bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-moss-ivory/80" : "border-transparent bg-transparent",
      )}
      style={{ backgroundColor: scrolled ? "color-mix(in srgb, var(--moss-ivory) 88%, transparent)" : undefined }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="Moss — home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <MossLogo size={32} />
        </Link>

        <nav aria-label="Landing sections" className="hidden items-center gap-6 md:flex">
          {SECTIONS.map((section) => (
            <SectionScrollLink key={section.id} sectionId={section.id}>
              {section.label}
            </SectionScrollLink>
          ))}
          {siteConfig.repositoryUrl ? (
            <a
              href={siteConfig.repositoryUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="size-4" aria-hidden />
              GitHub
            </a>
          ) : null}
        </nav>

        <div className="hidden md:block">
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/app">Open Workspace</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <nav id="landing-mobile-nav" aria-label="Landing sections" className="border-t bg-card px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <SectionScrollLink
                  sectionId={section.id}
                  className="block w-full py-1 text-left"
                  // close the sheet after choosing
                >
                  {section.label}
                </SectionScrollLink>
              </li>
            ))}
            <li className="pt-2">
              <Button asChild size="sm" className="w-full rounded-lg">
                <Link to="/app">Open Workspace</Link>
              </Button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
