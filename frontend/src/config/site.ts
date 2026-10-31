/**
 * Deployment configuration for Moss.
 *
 * Everything here is intentionally `null` until a real deployment provides
 * it — the frontend must not invent repository URLs, documentation links,
 * or legal claims. Configure via this file or `NEXT_PUBLIC_MOSS_REPO_URL`.
 */

export const siteConfig = {
  name: "Moss",
  tagline: "The Digital Backlog Gardener",
  /** Set to the public repository URL to enable GitHub CTAs, footer links,
   *  and "Explore the Source" buttons. Never hardcode a placeholder URL. */
  repositoryUrl: (process.env.NEXT_PUBLIC_MOSS_REPO_URL as string | undefined) ?? null,
  /** Set once documentation is published (e.g. a docs site or /docs route). */
  documentationUrl: null as string | null,
  /** License identifier shown in the footer only after it is verified in the
   *  repository. Leave null to omit the claim entirely. */
  license: null as string | null,
  copyright: `© ${new Date().getFullYear()} Moss contributors`,
};

export type SiteConfig = typeof siteConfig;
