import type { Status } from "../schema/primitives.js";
import { cn } from "../cn.js";
import { BADGE_HEIGHT } from "../layout/design.js";

const TONE: Record<Status, string> = {
  neutral: "bg-lens-chip border-lens-card-border text-lens-muted",
  positive: "bg-lens-positive-fill border-lens-positive-border text-lens-positive-text",
  caution: "bg-lens-caution-fill border-lens-caution-border text-lens-caution-text",
  critical: "bg-lens-critical-fill border-lens-critical-border text-lens-critical-text",
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
