import type { Metadata } from "next";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = {
  title: { absolute: "Операционный центр — LUMI Books" },
  description: "Управление заказами, каталогом, закупками и синхронизацией LUMI Books.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
