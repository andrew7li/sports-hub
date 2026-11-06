const GITHUB_OWNER = "andrew7li";
const GITHUB_REPO = "nhl-stats";
const WORKFLOW_FILE = "scrape-goalies.yml";
const WORKFLOW_REF = "main";

// Triggers the scrape-goalies.yml GitHub Actions workflow via the
// workflow_dispatch API. Runs from GitHub's own IP range rather than
// Vercel's, which is what actually gets past dailyfaceoff.com's bot
// protection — see scripts/scrape-goalies.ts for the scraper itself.
//
// The dispatch endpoint returns 204 with no body on success and doesn't
// hand back a run id, so this can confirm the request was accepted but not
// track the resulting run directly.
export async function dispatchGoalieScrape(date?: string): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_DISPATCH_TOKEN is not set");
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: WORKFLOW_REF,
        inputs: date ? { date } : {},
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub workflow dispatch failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
    );
  }
}
