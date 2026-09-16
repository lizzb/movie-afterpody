import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CardControls, CardShell } from "@/components/card/Card";

/**
 * Pass K7 — the one layout frame every semantic card (movie / episode / show)
 * is built from, so slot order and spacing live in a single file:
 *
 *   media | header · badges · body · footer      (controls float upper-right)
 *   user footer
 *   admin slot
 *
 * It is a frame, not a card: it carries no domain knowledge and is never
 * rendered directly by a route.
 */
export function MediaCardFrame({
  media,
  controls,
  header,
  badges,
  body,
  footer,
  userFooter,
  adminSlot,
  linkTo,
  dim = false,
  className = "p-3",
}: {
  media?: ReactNode | undefined;
  controls?: ReactNode | undefined;
  header: ReactNode;
  badges?: ReactNode | undefined;
  body?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  userFooter?: ReactNode | undefined;
  adminSlot?: ReactNode | undefined;
  /** When given, the media + content region is one big link target. */
  linkTo?: { to: string; params?: Record<string, string> } | undefined;
  dim?: boolean | undefined;
  className?: string | undefined;
}) {
  const content = (
    <>
      {media ? <div className="shrink-0">{media}</div> : null}
      <div className="min-w-0 flex-1">
        {header}
        {badges}
        {body}
        {footer}
      </div>
    </>
  );

  return (
    <CardShell dim={dim} className={className}>
      {controls ? <CardControls>{controls}</CardControls> : null}

      {linkTo ? (
        <Link
          to={linkTo.to}
          params={linkTo.params as never}
          className="flex items-start gap-3"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-start gap-3">{content}</div>
      )}

      {userFooter}
      {adminSlot}
    </CardShell>
  );
}
