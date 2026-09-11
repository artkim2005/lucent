import { Globe, Mail, MessageCircle, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const companyLinks = ["About", "Careers", "Press", "Contact"];
const helpLinks = ["Help Center", "Guides", "Privacy Policy", "Terms of Service"];
const connectIcons = [
  { Icon: Mail, label: "Email" },
  { Icon: Rss, label: "RSS feed" },
  { Icon: Globe, label: "Website" },
  { Icon: MessageCircle, label: "Community" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-elevated bg-surface">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-h2 font-bold text-text">Lucent</span>
            <Badge variant="neutral">NEWS</Badge>
          </div>
          <p className="text-body-s text-subtle">Balanced news coverage, powered by AI.</p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-caption font-semibold uppercase tracking-wider text-subtle">
            Company
          </p>
          {companyLinks.map((link) => (
            <a key={link} href="#" className="text-body-s text-subtle hover:text-text">
              {link}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-caption font-semibold uppercase tracking-wider text-subtle">
            Help
          </p>
          {helpLinks.map((link) => (
            <a key={link} href="#" className="text-body-s text-subtle hover:text-text">
              {link}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-caption font-semibold uppercase tracking-wider text-subtle">
            Connect
          </p>
          <div className="flex items-center gap-3">
            {connectIcons.map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-md bg-elevated text-subtle hover:text-text"
              >
                <Icon className="size-4" strokeWidth={1.6} strokeLinecap="round" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-elevated px-6 py-4">
        <p className="mx-auto max-w-[1400px] text-caption text-subtle">
          © {new Date().getFullYear()} Lucent News. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
