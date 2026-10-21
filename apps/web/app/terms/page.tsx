import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "../lib/brand";

export default function TermsRedirect() {
  redirect("/" + DEFAULT_LOCALE + "/terms");
}
