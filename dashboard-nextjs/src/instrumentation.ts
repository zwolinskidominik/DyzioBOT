/**
 * Next.js instrumentation hook — uruchamia się RAZ, przy starcie procesu serwera,
 * zanim jakikolwiek request trafi do jakiejkolwiek trasy. To jedyne miejsce
 * gwarantujące, że poniższe ustawienie zadziała dla WSZYSTKICH ~50 tras
 * `api/guild/[guildId]/**`, mimo że każda z nich łączy się z Mongo osobno
 * (własny lokalny `connectDB()`), a nie przez jeden współdzielony moduł.
 *
 * https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const mongoose = (await import("mongoose")).default;

    // Blokuje NoSQL injection — operatory Mongo ($where, $gt, $ne, itp.) w
    // obiektach filtrujących pochodzących z niezaufanego inputu są odrzucane
    // zamiast wykonane. Patrz docs/SECURITY.md §A03.
    mongoose.set("sanitizeFilter", true);
  }
}
