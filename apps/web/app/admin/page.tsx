import type { Metadata } from "next";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = {
  title: { absolute: "Գրքասեր — управление магазином" },
  description: "Защищённый кабинет управления книжным магазином Grqaser.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
