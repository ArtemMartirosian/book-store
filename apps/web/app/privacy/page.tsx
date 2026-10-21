import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "../lib/brand";

export default function PrivacyRedirect() {
  redirect("/" + DEFAULT_LOCALE + "/privacy");
}
