export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const container = "lumi-container";
export const serif = "font-display";
export const eyebrow = "inline-flex items-center gap-2.5 rounded-full bg-[#ebe9ff] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#5147e2]";
export const sectionTitle = "font-display text-[clamp(2.25rem,4.6vw,4.5rem)] font-black leading-[0.96] tracking-[-0.065em]";
export const primaryButton = "inline-flex min-h-13 items-center justify-center gap-6 rounded-2xl bg-[#6258ff] px-6 text-[10px] font-black uppercase tracking-[.08em] text-white shadow-[0_14px_30px_rgba(98,88,255,.28)] transition duration-300 hover:-translate-y-1 hover:bg-[#473dd4] hover:shadow-[0_18px_38px_rgba(98,88,255,.34)]";

export const accentClasses = {
  amber: "bg-[#ffbd5c] text-[#151722]",
  coral: "bg-[#ff6b7a] text-white",
  mint: "bg-[#d9ff69] text-[#151722]",
  blue: "bg-[#506dff] text-white",
  violet: "bg-[#7e64dd] text-white",
  sand: "bg-[#ffdca8] text-[#151722]",
} as const;

export const coverSizeClasses = {
  mini: "h-[126px] w-[84px] p-[12px_8px_10px_14px]",
  card: "h-[286px] w-[190px] p-[24px_19px_20px_24px] max-xl:h-[252px] max-xl:w-[168px] max-sm:h-[198px] max-sm:w-[132px] max-sm:p-[17px_12px_15px_18px]",
  hero: "aspect-[.66] w-full p-[29px_23px_25px_29px]",
  detail: "aspect-[.66] w-[min(330px,72vw)] p-[38px_31px_32px_39px] max-sm:w-[235px]",
} as const;
