import { useState } from "react";

import { Button } from "@findgigs/ui/button";
import { Input } from "@findgigs/ui/input";

import { authClient } from "~/auth/client";

export function AuthShowcase() {
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={isSignUp ? "" : "hidden"}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          size="lg"
          onClick={async () => {
            setError(null);
            if (isSignUp) {
              const res = await authClient.signUp.email({
                email,
                password,
                name,
              });
              if (res.error) {
                setError(res.error.message ?? "Sign up failed");
              }
            } else {
              const res = await authClient.signIn.email({
                email,
                password,
              });
              if (res.error) {
                setError(res.error.message ?? "Sign in failed");
              }
            }
          }}
        >
          {isSignUp ? "Sign up" : "Sign in"}
        </Button>
        <button
          className="text-muted-foreground text-sm underline"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
        <div className="flex w-full items-center gap-2">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">or</span>
          <div className="bg-border h-px flex-1" />
        </div>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => authClient.signIn.social({ provider: "google" })}
        >
          Sign in with Google
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => authClient.signIn.social({ provider: "apple" })}
        >
          Sign in with Apple
        </Button>
      </div>
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
