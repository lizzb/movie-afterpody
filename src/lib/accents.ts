export type Accent = "coral" | "berry" | "gold" | "purple" | "teal" | "navy";

const ACCENTS: Accent[] = ["coral", "berry", "gold", "purple", "teal", "navy"];

export function toAccent(value: string | null | undefined): Accent {
  if (value && (ACCENTS as string[]).includes(value)) return value as Accent;
  return "coral";
}

/** Deterministic accent from any string, so seeded rows without one still look intentional. */
export function accentFor(seed: string): Accent {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return ACCENTS[hash % ACCENTS.length]!;
}

const SOLID: Record<Accent, string> = {
  coral: "bg-coral text-primary-foreground",
  berry: "bg-berry text-primary-foreground",
  gold: "bg-gold text-accent-foreground",
  purple: "bg-purple text-primary-foreground",
  teal: "bg-teal text-primary-foreground",
  navy: "bg-navy text-primary-foreground",
};

const SOFT: Record<Accent, string> = {
  coral: "bg-coral-soft text-coral",
  berry: "bg-berry-soft text-berry",
  gold: "bg-gold-soft text-navy",
  purple: "bg-purple-soft text-purple",
  teal: "bg-teal-soft text-teal",
  navy: "bg-navy-soft text-navy",
};

const TEXT: Record<Accent, string> = {
  coral: "text-coral",
  berry: "text-berry",
  gold: "text-gold",
  purple: "text-purple",
  teal: "text-teal",
  navy: "text-navy",
};

const FILL: Record<Accent, string> = {
  coral: "bg-coral",
  berry: "bg-berry",
  gold: "bg-gold",
  purple: "bg-purple",
  teal: "bg-teal",
  navy: "bg-navy",
};

export const accentSolid = (a: Accent) => SOLID[a];
export const accentSoft = (a: Accent) => SOFT[a];
export const accentText = (a: Accent) => TEXT[a];
export const accentFill = (a: Accent) => FILL[a];
