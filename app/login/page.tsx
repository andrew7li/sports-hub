import { Suspense } from "react";
import type { Metadata } from "next";
import { SPORTS } from "@/lib/sports";
import { Logo } from "@/app/components/Logo";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 size-12" />
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">
            Welcome to SportsHub
          </h1>
          <p className="text-sm text-muted mb-1">Sign in to view stats.</p>
          <p className="text-xs italic">
            {`"There are only winners and quitters in gambling."`}
          </p>
        </div>

        <div className="rounded-2xl border border-line p-6">
          <form action={loginAction} className="flex flex-col gap-3">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoFocus
              className="rounded-lg border border-line bg-transparent px-3 py-2 outline-none focus:border-foreground"
            />
            {/* searchParams is request-time data, so it needs its own
                Suspense boundary to keep the rest of the page prerendered. */}
            <Suspense>
              <LoginError searchParams={searchParams} />
            </Suspense>
            <button
              type="submit"
              className="mt-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Sign in
            </button>
          </form>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {SPORTS.map((sport) => (
            <span
              key={sport.slug}
              className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted"
            >
              {sport.name}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

async function LoginError({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="text-sm text-red-500">Incorrect password.</p>;
}
