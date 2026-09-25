import type { FormEvent } from "react";
import { Button } from "../ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { TextField } from "../ui/text-field";

export interface SignInProps {
  onSubmit?: (data: { email: string; password: string; remember: boolean }) => void;
}

/** Centered sign in card. Wears whatever theme is active. */
export default function SignIn({ onSubmit }: SignInProps) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit?.({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      remember: form.get("remember") === "on",
    });
  }

  return (
    <div className="mi-block mi-block-center">
      <form className="mi-auth" onSubmit={submit}>
        <Card>
          <CardHeader>
            <span className="mi-auth-mark" aria-hidden="true">
              m
            </span>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to keep building.</CardDescription>
          </CardHeader>
          <CardBody className="mi-block-stack">
            <TextField label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
            <div className="mi-block-between">
              <Checkbox name="remember">Remember me</Checkbox>
              <a className="mi-block-small" href="#reset" style={{ color: "var(--mi-accent)" }}>
                Forgot password?
              </a>
            </div>
          </CardBody>
          <CardFooter className="mi-block-stack">
            <Button variant="primary" type="submit" style={{ width: "100%" }}>
              Sign in
            </Button>
            <p className="mi-auth-divider">or</p>
            <Button type="button" style={{ width: "100%" }}>
              Continue with a magic link
            </Button>
          </CardFooter>
        </Card>
        <p className="mi-auth-foot" style={{ marginTop: "var(--mi-space-4)" }}>
          No account yet? <a href="#signup">Create one</a>
        </p>
      </form>
    </div>
  );
}
