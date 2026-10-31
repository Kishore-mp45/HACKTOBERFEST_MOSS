"use client";

import { usePageTitle } from "@/hooks/moss";
import { LandingNav } from "./nav";
import { Hero } from "./hero";
import { Features, HowItWorks, Introducing, Problem } from "./sections-core";
import { Showcase } from "./showcase";
import { Community, FinalCta, LandingFooter, LocalAI, Trust } from "./sections-tail";

/** The public marketing site — sections A through K of the Moss story. */
export function LandingPage() {
  usePageTitle(null);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />
      <main id="main" className="flex-1">
        <Hero />
        <Problem />
        <Introducing />
        <Features />
        <HowItWorks />
        <Showcase />
        <LocalAI />
        <Trust />
        <Community />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
