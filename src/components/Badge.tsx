import type { Status } from "../schema/primitives.js";
import { cn } from "../cn.js";
import { BADGE_HEIGHT } from "../layout/design.js";

const TONE: Record<Status, string> = {
  neutral: "bg-conduit-chip border-conduit-card-border text-conduit-muted",
  positive: "bg-conduit-positive-fill border-conduit-positive-border text-conduit-positive-text",
  caution: "bg-conduit-caution-fill border-conduit-caution-border text-conduit-caution-text",
  critical: "bg-conduit-critical-fill border-conduit-critical-border text-conduit-critical-text",
};

export const Badge = ({ label, tone }: { label: string; tone: Status }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-[9px] text-[8.5px] font-bold uppercase leading-none tracking-[0.06em] whitespace-nowrap",
      TONE[tone],
    )}
    style={{ height: BADGE_HEIGHT }}
  >
    {label}
  </span>
);
