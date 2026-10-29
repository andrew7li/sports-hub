import Link from "next/link";
import { logoutAction } from "../login/actions";
import { NavLinks } from "./NavLinks";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo className="size-7" />
          <span className="hidden sm:inline">SportsHub</span>
        </Link>
        <div className="flex items-center gap-3">
          <NavLinks />
          <span className="h-5 w-px bg-line" />
          {/* Every page under (site) is behind proxy.ts, so whoever sees
              this header is already signed in. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
