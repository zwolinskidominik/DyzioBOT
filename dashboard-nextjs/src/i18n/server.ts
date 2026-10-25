import { cookies, headers } from "next/headers";
import { LANG_COOKIE, resolveLang, type Lang } from "./config";

/** Język panelu po stronie serwera (layout, strony serwerowe, metadane). */
export async function getLang(): Promise<Lang> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLang(cookieStore.get(LANG_COOKIE)?.value, headerStore.get("accept-language"));
}
