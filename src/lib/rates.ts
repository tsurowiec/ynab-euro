type NbpResponse = { rates: [{ mid: number }] };

export async function fetchRateToPln(currency: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.nbp.pl/api/exchangerates/rates/a/${currency.toLowerCase()}/?format=json`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as NbpResponse;
    return json.rates[0].mid;
  } catch {
    return null;
  }
}
