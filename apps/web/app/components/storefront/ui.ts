export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const container = "mx-auto w-[min(1520px,calc(100%-3rem))] max-md:w-[calc(100%-2rem)]";
export const serif = "font-sans";
export const eyebrow = "inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6558ff]";
export const sectionTitle = "text-[clamp(2.6rem,4.4vw,4.75rem)] font-black leading-[0.9] tracking-[-0.065em]";
export const primaryButton = "inline-flex min-h-13 items-center justify-center gap-8 rounded-[14px] bg-[#2447ff] px-7 text-[10px] font-black uppercase tracking-[.05em] text-white transition hover:-translate-y-1 hover:bg-[#111] hover:shadow-[0_14px_30px_rgba(36,71,255,.22)]";

export const accentClasses = {
  amber: "bg-[#f8c84e] text-[#111]",
  coral: "bg-[#ff715b] text-white",
  mint: "bg-[#7ee2be] text-[#111]",
  blue: "bg-[#3656ff] text-white",
  violet: "bg-[#6558ff] text-white",
  sand: "bg-[#dfe3ea] text-[#111]",
} as const;

export const coverSizeClasses = {
  mini: "h-[122px] w-[82px] p-[12px_8px_10px_14px]",
  card: "h-[278px] w-[184px] p-[24px_19px_20px_24px] max-xl:h-[250px] max-xl:w-[165px] max-sm:h-[187px] max-sm:w-[123px] max-sm:p-[17px_12px_15px_18px]",
  hero: "aspect-[.66] w-full p-[29px_23px_25px_29px]",
  detail: "aspect-[.66] w-[min(310px,72vw)] p-[38px_31px_32px_39px] max-sm:w-[235px]",
} as const;
