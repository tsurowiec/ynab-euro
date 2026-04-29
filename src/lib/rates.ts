import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

type NbpResponse = { rates: Array<{ effectiveDate: string; mid: number }> };
type RateEntry = { rate: number; rateDate: string };
type RatesCache = Record<string, RateEntry>;

const cacheDir = ".cache";
const cacheFile = `${cacheDir}/rates.json`;

function loadCache(): RatesCache {
  if (!existsSync(cacheFile)) return {};
  return JSON.parse(readFileSync(cacheFile, "utf8")) as RatesCache;
}

function saveCache(cache: RatesCache): void {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir);
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function fetchRateForDate(
  currency: string,
  date: string
): Promise<RateEntry | null> {
  const key = `${currency.toUpperCase()}:${date}`;
  const cache = loadCache();

  if (cache[key]) return cache[key];

  const startDate = subtractDays(date, 7);
  try {
    const res = await fetch(
      `https://api.nbp.pl/api/exchangerates/rates/a/${currency.toLowerCase()}/${startDate}/${date}/?format=json`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as NbpResponse;
    const last = json.rates.at(-1);
    if (!last) return null;

    const entry: RateEntry = { rate: last.mid, rateDate: last.effectiveDate };
    cache[key] = entry;
    saveCache(cache);
    return entry;
  } catch {
    return null;
  }
}
