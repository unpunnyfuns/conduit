import type { NodeKind } from "../schema/primitives.js";
import { assertNever } from "../assert.js";
import { cn } from "../cn.js";

const FILL = "fill-conduit-muted";
const STROKE = "fill-none stroke-conduit-muted stroke-[1.4]";

const Stroked = ({ d }: { d: string }) => <path className={STROKE} d={d} />;

const Rect = ({ w, h, r }: { w: number; h: number; r?: number }) => (
  <rect className={STROKE} x={-w / 2} y={-h / 2} width={w} height={h} rx={r} />
);

const Text = ({ children, className }: { children: string; className: string }) => (
  <text className={cn(FILL, className)} x={0} y={4.5} textAnchor="middle">
    {children}
  </text>
);

const glyph = (kind: NodeKind) => {
  switch (kind) {
    case "service":
      return (
        <>
          <Rect w={13} h={13} r={3} />
          <circle className={FILL} cx={0} cy={0} r={2} />
        </>
      );
    case "app":
      return (
        <>
          <Rect w={14} h={12} r={2} />
          <Stroked d="M-7,-2 h14" />
        </>
      );
    case "module":
      return <Text className="text-[11px] font-mono">{"{ }"}</Text>;
    case "function":
      return <Text className="text-[14px] italic font-serif">ƒ</Text>;
    case "route":
      return <path className={FILL} d="M-7,-6 L7,0 L-7,6 Z" />;
    case "job":
      return (
        <>
          <circle className={STROKE} cx={0} cy={0} r={6.5} />
          <Stroked d="M0,-3.5 V0 H3" />
        </>
      );
    case "queue":
      return (
        <>
          <Stroked d="M-6.5,-4.5 h13" />
          <Stroked d="M-6.5,0 h13" />
          <Stroked d="M-6.5,4.5 h13" />
        </>
      );
    case "datastore":
      return (
        <>
          <ellipse className={STROKE} cx={0} cy={-4.5} rx={6.5} ry={2.6} />
          <Stroked d="M-6.5,-4.5 v9 a6.5,2.6 0 0 0 13 0 v-9" />
        </>
      );
    case "cache":
      return <path className={FILL} d="M1,-7 L-6,1 H-1 L-1,7 L6,-1 H1 Z" />;
    case "external":
      return (
        <>
          <Rect w={16} h={12} r={2} />
          <Stroked d="M-8,-4 l8,6 8,-6" />
        </>
      );
    case "ui":
      return (
        <>
          <Rect w={14} h={12} r={2} />
          <Stroked d="M-2.5,-6 v12" />
        </>
      );
    case "config":
      return (
        <>
          <Stroked d="M-7,-4 h14" />
          <Stroked d="M-7,4 h14" />
          <circle className={FILL} cx={-2} cy={-4} r={2.2} />
          <circle className={FILL} cx={3} cy={4} r={2.2} />
        </>
      );
    case "test":
      return <Stroked d="M-6,0 l4,4 l8,-8" />;
    case "package":
      return (
        <>
          <Stroked d="M0,-7 l6.5,3.5 v7 l-6.5,3.5 l-6.5,-3.5 v-7 Z" />
          <Stroked d="M-6.5,-3.5 l6.5,3.5 l6.5,-3.5" />
          <Stroked d="M0,0 v7" />
        </>
      );
    case "other":
      return (
        <>
          <circle className={FILL} cx={-5} cy={0} r={1.8} />
          <circle className={FILL} cx={0} cy={0} r={1.8} />
          <circle className={FILL} cx={5} cy={0} r={1.8} />
        </>
      );
    default:
      return assertNever(kind, "Unhandled node kind");
  }
};

/** The chip glyph for a node's kind: "what sort of thing is this" at a glance. */
export const KindIcon = ({ kind, className }: { kind: NodeKind; className?: string }) => (
  <svg viewBox="-13 -13 26 26" width={26} height={26} aria-hidden className={className}>
    {glyph(kind)}
  </svg>
);
