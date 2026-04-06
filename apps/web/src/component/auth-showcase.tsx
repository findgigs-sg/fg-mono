import { Button } from "@findgigs/ui/button";

import { authClient } from "~/auth/client";

export function AuthShowcase() {
  const { data: session } = authClient.useSession();

  if (!session) {
    return (
      <Button size="lg" disabled>
        Sign in (coming soon)
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user.name}</span>
      </p>

      <Button
        size="lg"
        onClick={async () => {
          await authClient.signOut();
          window.location.href = "/";
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
