import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Box } from "../../layout/geometry.js";
import { placePopover, POPOVER_WIDTH, type Size } from "./place.js";

export type PopoverProps = {
  anchor: Box;
  canvas: Size;
  /** Id of the element inside that names this dialog. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
};

const isOwnTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(
    "[data-conduit-popover], [data-edge-hit], [data-conduit-node] button, [data-conduit-edge-list]",
  ) !== null;

/**
 * A dialog pinned inside the canvas beside its anchor, so it scrolls and
 * scales with the drawing. It measures itself once mounted to pick a side
 * that fits; until then it is laid out but invisible.
 */
export const Popover = ({ anchor, canvas, labelledBy, onClose, children }: PopoverProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const previousFocusRef = useRef<Element | null>(null);
  // Guarded lazy init: reads document.activeElement on first render, before
  // the popover can take focus itself, so it captures what the user had
  // focused before opening it rather than the dialog after.
  if (previousFocusRef.current === null) previousFocusRef.current = document.activeElement;
  const hasFocusedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Re-measures after every render; setHeight bails out when the value is
  // unchanged, so this stays cheap while picking up content/anchor changes
  // without having to track them as explicit effect dependencies.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = ref.current;
    if (node !== null) setHeight(node.offsetHeight);
  });

  useLayoutEffect(() => {
    if (height !== undefined && !hasFocusedRef.current) {
      hasFocusedRef.current = true;
      ref.current?.focus();
    }
  }, [height]);

  // Mount-only: listens for the lifetime of this dialog instance and always
  // calls the latest onClose via the ref, so an inline onClose identity
  // never tears the listeners down and re-adds them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onDown = (event: MouseEvent) => {
      if (!isOwnTarget(event.target)) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  // Mount-only: restores focus exactly once, when this dialog instance
  // unmounts, regardless of how many times it re-rendered in between.
  useEffect(() => {
    return () => {
      const previous = previousFocusRef.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  const box = placePopover(anchor, { width: POPOVER_WIDTH, height: height ?? 0 }, canvas);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      data-conduit-popover
      className="absolute z-10 rounded-[10px] border border-conduit-card-border bg-conduit-card p-[14px] text-conduit-fg shadow-[0_4px_12px_var(--color-conduit-shadow)] outline-none"
      style={{
        left: box.x,
        top: box.y,
        width: POPOVER_WIDTH,
        visibility: height === undefined ? "hidden" : "visible",
      }}
    >
      {children}
    </div>
  );
};
