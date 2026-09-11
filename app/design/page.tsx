import {
  BarChart3,
  Bell,
  Bookmark,
  Grid3x3,
  Heart,
  Settings,
} from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { Badge } from "@/components/ui/badge";
import { BiasIndicator } from "@/components/ui/bias-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <p className="mb-4 text-caption font-semibold uppercase tracking-wider text-subtle">
        {title}
      </p>
      {children}
    </Card>
  );
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("h-14 w-full rounded-md border border-elevated", className)} />
      <div>
        <p className="text-body-s font-medium text-text">{name}</p>
        <p className="text-caption text-subtle">{hex}</p>
      </div>
    </div>
  );
}

const icons = [
  { Icon: Grid3x3, label: "Line style" },
  { Icon: Bell, label: "1.6px stroke" },
  { Icon: Bookmark, label: "Rounded caps" },
  { Icon: Settings, label: "Settings" },
  { Icon: Heart, label: "Heart" },
  { Icon: BarChart3, label: "Bar chart" },
];

const spacingSteps = [8, 16, 24, 32, 40, 48];
const radii = [
  { name: "None", className: "rounded-none" },
  { name: "Small", className: "rounded-sm" },
  { name: "Medium", className: "rounded-md" },
  { name: "Large", className: "rounded-lg" },
  { name: "Full", className: "rounded-full" },
];
const shadows = [
  { name: "Small", className: "shadow-sm" },
  { name: "Medium", className: "shadow-md" },
  { name: "Large", className: "shadow-lg" },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-6 md:p-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <Panel title="Brand">
            <div className="flex items-center gap-2">
              <span className="text-h1 font-bold text-text">Lucent</span>
              <Badge variant="neutral">NEWS</Badge>
            </div>
            <p className="mt-2 text-body-s text-subtle">
              Balanced news coverage, powered by AI
            </p>
          </Panel>

          <Panel title="Colors">
            <p className="mb-2 text-caption text-subtle">Neutrals</p>
            <div className="mb-5 grid grid-cols-4 gap-3">
              <Swatch name="Base" hex="#08090F" className="bg-base" />
              <Swatch name="Surface" hex="#0F1219" className="bg-surface" />
              <Swatch name="Elevated" hex="#161C2E" className="bg-elevated" />
              <Swatch name="Subtle" hex="#3A4468" className="bg-subtle" />
            </div>
            <div className="mb-5">
              <Swatch name="Text" hex="#E8ECF8" className="bg-text" />
            </div>
            <p className="mb-2 text-caption text-subtle">Primary</p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <Swatch name="Violet" hex="#7B6EFA" className="bg-violet" />
              <Swatch name="Violet/15" hex="15%" className="bg-violet/15" />
            </div>
            <p className="mb-2 text-caption text-subtle">Accent</p>
            <div className="grid grid-cols-2 gap-3">
              <Swatch name="Cyan" hex="#22D3EE" className="bg-cyan" />
              <Swatch name="Red" hex="#EF4444" className="bg-red" />
            </div>
          </Panel>

          <Panel title="Spacing system (base 8px)">
            <div className="flex flex-wrap items-end gap-4">
              {spacingSteps.map((step) => (
                <div key={step} className="flex flex-col items-center gap-2">
                  <div
                    className="rounded-sm bg-violet"
                    style={{ width: step, height: step }}
                  />
                  <p className="text-caption text-subtle">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-caption text-subtle">
              Consistent spacing units based on 8px grid
            </p>
          </Panel>
        </div>

        {/* Middle column */}
        <div className="flex flex-col gap-6">
          <Panel title="Typography">
            <p className="text-h2 font-semibold text-text">Bricolage Grotesque</p>
            <p className="mb-4 text-body-s text-violet">
              A versatile variable grotesque — expressive at display sizes, legible at body.
            </p>

            <div className="flex flex-col gap-3 border-t border-elevated pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-h1 font-bold text-text">H1 Display Title</span>
                <span className="whitespace-nowrap text-caption text-subtle">700 / 22px</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-h2 font-semibold text-text">H2 Section Heading</span>
                <span className="whitespace-nowrap text-caption text-subtle">600 / 18px</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-h3 font-semibold text-text">H3 Subsection Title</span>
                <span className="whitespace-nowrap text-caption text-subtle">600 / 15px</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-h4 font-semibold text-text">H4 Card Label</span>
                <span className="whitespace-nowrap text-caption text-subtle">600 / 13px</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-elevated pt-4">
              <div>
                <span className="mr-2 text-caption text-subtle">Body L</span>
                <span className="text-body-l text-text">Long-form paragraph text at body large.</span>
              </div>
              <div>
                <span className="mr-2 text-caption text-subtle">Body S</span>
                <span className="text-body-s text-text">Supporting and secondary body copy.</span>
              </div>
              <div>
                <span className="mr-2 text-caption text-subtle">Caption</span>
                <span className="text-caption text-subtle">Metadata · labels · timestamps</span>
              </div>
            </div>
          </Panel>

          <Panel title="Icons">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {icons.map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-md bg-elevated text-text">
                    <Icon className="size-5" strokeWidth={1.6} strokeLinecap="round" />
                  </div>
                  <p className="text-center text-caption text-subtle">{label}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Grid system">
            <div className="grid grid-cols-12 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-10 rounded-sm",
                    i < 4 ? "bg-violet/60" : i < 8 ? "bg-cyan/30" : "bg-elevated",
                  )}
                />
              ))}
            </div>
            <p className="mt-3 text-caption text-subtle">
              12 columns · Gutter: 16px · Margin: 24px
            </p>
          </Panel>

          <div className="grid grid-cols-2 gap-6">
            <Panel title="Shadows">
              <div className="flex flex-col gap-4">
                {shadows.map((s) => (
                  <div key={s.name} className="flex flex-col items-center gap-2">
                    <div className={cn("h-14 w-full rounded-md bg-elevated", s.className)} />
                    <p className="text-caption text-subtle">{s.name}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Border radius">
              <div className="grid grid-cols-2 gap-4">
                {radii.map((r) => (
                  <div key={r.name} className="flex flex-col items-center gap-2">
                    <div className={cn("h-14 w-full bg-elevated", r.className)} />
                    <p className="text-caption text-subtle">{r.name}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <Panel title="UI elements">
            <p className="mb-2 text-caption text-subtle">Buttons</p>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="mb-5">
              <Button variant="destructive">Destructive</Button>
            </div>

            <p className="mb-2 text-caption text-subtle">Link</p>
            <a href="#" className="mb-5 inline-block text-body-s font-medium text-violet underline underline-offset-4">
              Read full article →
            </a>

            <p className="mb-2 text-caption text-subtle">Checkbox</p>
            <div className="mb-5 flex flex-col gap-2">
              <Checkbox id="checked-demo" defaultChecked label="Checked state" />
              <Checkbox id="unchecked-demo" label="Unchecked state" />
            </div>

            <p className="mb-2 text-caption text-subtle">Labels / Tags</p>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Politics</Badge>
              <Badge variant="accent">Business &amp; Markets ★</Badge>
              <Badge variant="destructive">Breaking</Badge>
            </div>

            <p className="mb-2 text-caption text-subtle">Bias indicators</p>
            <BiasIndicator leftPercentage={34} centerPercentage={50} rightPercentage={16} />
          </Panel>

          <div>
            <p className="mb-4 text-caption font-semibold uppercase tracking-wider text-subtle">
              Card example
            </p>
            <ArticleCard
              sourceName="Reuters"
              sourceCountry="United States"
              category="Politics"
              publishedAgo="2h ago"
              title="Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report"
              description="The proposed framework includes revised sanctions relief and enforced timelines on nuclear activity…"
            />
          </div>
        </div>
      </div>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-elevated pt-6 text-caption text-subtle sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">Lucent</span>
          <span>Balanced news coverage, powered by AI</span>
        </div>
        <span>Design System v1.0 · Jul 2026</span>
        <span>lucent.news/design</span>
      </footer>
    </main>
  );
}
