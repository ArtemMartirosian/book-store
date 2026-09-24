export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const container = "lumi-container";
export const serif = "font-display";
export const eyebrow = "text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]";
export const sectionTitle = "font-display text-[clamp(1.6rem,3vw,2.5rem)] font-bold leading-[1.15] tracking-[-.035em]";
export const primaryButton = "inline-flex min-h-12 items-center justify-center gap-5 rounded-xl bg-[var(--accent)] px-7 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--accent-deep)] hover:shadow-[0_8px_20px_rgba(98,88,255,.15)] focus-visible:outline-offset-4 disabled:opacity-50";

export const accentClasses = {
  amber: "bg-[#cba85e] text-[#23312a]",
  coral: "bg-[#b46650] text-[#fff8ea]",
  mint: "bg-[#b8c6a7] text-[#243e35]",
  blue: "bg-[#486976] text-[#fff8ea]",
  violet: "bg-[#776378] text-[#fff8ea]",
  sand: "bg-[#e5d7b9] text-[#4f4b35]",
} as const;

export const coverSizeClasses = {
  mini: "h-[114px] w-[76px] p-[12px_8px_10px_14px]",
  card: "h-[240px] w-[160px] p-[22px_16px_18px_22px] max-sm:h-[186px] max-sm:w-[124px] max-sm:p-[16px_12px_14px_16px]",
  hero: "aspect-[.66] w-full p-[26px_20px_22px_26px]",
  detail: "aspect-[.66] w-[min(330px,72vw)] p-[38px_31px_32px_39px] max-sm:w-[235px]",
} as const;
