import type { Lane } from "../schema/document.js";
import { cn } from "../cn.js";
import { LANE_PADDING_X } from "../layout/design.js";
import type { Box } from "../layout/geometry.js";

export type LaneBandProps = { id?: string; lane: Lane; box: Box; dimmed?: boolean };

/** The grouping band behind a lane's cards, with its tracked uppercase header. */
export const LaneBand = ({ id, lane, box, dimmed = false }: LaneBandProps) => (
  <div
    data-conduit-lane={id}
    className={cn("absolute rounded-xl bg-conduit-lane transition-opacity", dimmed && "opacity-45")}
    style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
  >
    <div
      className="absolute top-[14px] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-conduit-muted"
      style={{ left: LANE_PADDING_X, width: box.width - LANE_PADDING_X * 2 }}
    >
      {lane.subtitle === undefined ? lane.label : `${lane.label} · ${lane.subtitle}`}
    </div>
  </div>
);
