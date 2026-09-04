import { useState } from "react";

/** Feed descriptions arrive as HTML — read them as plain sentences. */
function toPlainText(raw: string) {
  return raw
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Episode descriptions read as two lines until asked for more — the same
 * in-place expander used in admin Match review (Pass U24).
 */
export function ExpandableText({
  text,
  className = "",
  lines = 2,
}: {
  text: string | null | undefined;
  className?: string;
  lines?: 2 | 3;
}) {
  const [open, setOpen] = useState(false);
  const value = toPlainText(text ?? "");
  if (!value) return null;


  return (
    <div className={className}>
      <p className={open ? "break-anywhere" : `${lines === 2 ? "line-clamp-2" : "line-clamp-3"}`}>
        {value}
      </p>
      {value.length > 120 ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="mt-0.5 text-[11px] font-semibold text-coral hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
