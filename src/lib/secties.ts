// Knipt de HTML van een Markdown-pagina in secties: het stuk vóór de eerste tussenkop,
// en daarna per tussenkop (##) één sectie. Zo blijft de tekst gewone Markdown en kan een
// pagina toch elke sectie een eigen plek en vorm geven.
export interface Sectie {
  /** adres binnen de pagina, afgeleid van de kop: "Wat je krijgt" -> "wat-je-krijgt" */
  id: string;
  /** de tekst van de tussenkop, zonder opmaak */
  kop: string;
  /** de HTML onder de tussenkop, zonder de kop zelf */
  html: string;
}

const kaal = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();

export const slug = (tekst: string) =>
  tekst.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function secties(html: string | undefined): { vooraf: string; lijst: Sectie[] } {
  const delen = (html ?? '').split(/(?=<h2[\s>])/);
  const vooraf = delen.length && !/^<h2[\s>]/.test(delen[0]) ? delen.shift()!.trim() : '';
  const lijst = delen.map((deel) => {
    const m = deel.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
    const kop = m ? kaal(m[1]) : '';
    return { id: slug(kop), kop, html: m ? deel.slice(m[0].length).trim() : deel };
  });
  return { vooraf, lijst };
}

/** Een kop eindigt in de huisstijl met een punt of een vraagteken. */
export const metPunt = (kop: string) => (/[.?!:]$/.test(kop.trim()) ? kop.trim() : `${kop.trim()}.`);

/**
 * Knipt een sectie verder op bij alinea's die alleen uit een vetgedrukt kopje bestaan
 * ("**Wat je krijgt**" op een eigen regel). Geeft de tekst ervoor en de blokken terug.
 */
export function blokken(html: string): { vooraf: string; lijst: { kop: string; html: string }[] } {
  const delen = html.split(/<p>\s*<strong>([^<]+)<\/strong>\s*<\/p>/);
  const vooraf = (delen.shift() ?? '').trim();
  const lijst = [];
  for (let i = 0; i + 1 < delen.length; i += 2) lijst.push({ kop: delen[i].trim(), html: delen[i + 1].trim() });
  return { vooraf, lijst };
}
