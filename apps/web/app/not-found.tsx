import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 560, textAlign: "center" }}>
        <p style={{ color: "var(--muted)", letterSpacing: ".16em", textTransform: "uppercase" }}>Ошибка 404</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 8vw, 6.5rem)", lineHeight: .92, margin: "16px 0" }}>
          Эта страница потерялась между строк
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.6 }}>
          Вернитесь в каталог — там точно найдётся следующая хорошая история.
        </p>
        <Link href="/catalog" style={{ display: "inline-flex", marginTop: 20, padding: "14px 22px", borderRadius: 999, background: "var(--night)", color: "white", fontWeight: 750 }}>
          Открыть каталог
        </Link>
      </section>
    </main>
  );
}
