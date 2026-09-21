import type { ErrorComponentProps } from "@tanstack/react-router";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = error instanceof Error && error.message ? error.message : "An unexpected error occurred.";
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center text-fg">
      <div>
        <h1 className="hud-label text-lg">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      </div>
    </main>
  );
}
