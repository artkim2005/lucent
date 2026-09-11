import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navTabs = [
  { label: "Home", active: true },
  { label: "For You", active: false },
  { label: "Local", active: false },
  { label: "Blindspot", active: false },
];

export function SiteHeader() {
  return (
    <header className="border-b border-elevated bg-surface">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-h1 font-bold text-text">Lucent</span>
          <Badge variant="neutral">NEWS</Badge>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navTabs.map((tab) =>
            tab.active ? (
              <span
                key={tab.label}
                className="border-b-2 border-violet pb-1 text-body-s font-semibold text-text"
              >
                {tab.label}
              </span>
            ) : (
              <span key={tab.label} className="pb-1 text-body-s text-subtle">
                {tab.label}
              </span>
            ),
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="secondary">Log in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="primary">Sign up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
