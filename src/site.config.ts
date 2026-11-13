// Centrale gegevens van de site. Pas hier aan; alle pagina's lezen dit bestand.

export const site = {
  naam: 'Ongelijk Investeren',
  bureau: 'Bureau Ongelijk Investeren',
  mail: 'maurijn@ongelijkinvesteren.nl',

  // Bedrijfsgegevens (voettekst). Vervang "nog invullen" door de echte waarde.
  adres: 'nog invullen',
  kvk: 'nog invullen',
  btw: 'nog invullen',
  telefoon: 'nog invullen',
  linkedin: 'nog invullen',

  // Het contactformulier bij Tally. Zolang het formulier niet gepubliceerd is, staat tallyLive op false
  // en toont de contactpagina alleen het mailadres. Na publicatie: tallyLive op true zetten.
  tallyId: 'je6gL4',
  tallyLive: true,

  // true = smalle balk "Werkversie · niet gepubliceerd" bovenaan elke pagina. Bij de livegang op false zetten.
  werkversie: true,

  // Hoofdmenu. "knop: true" toont het item als knop.
  menu: [
    { tekst: 'Dashboard', link: '/dashboard/' },
    { tekst: 'Aanbod', link: '/aanbod/' },
    { tekst: 'Masterclass', link: '/masterclass/' },
    { tekst: 'Methode', link: '/methode/' },
    { tekst: 'Over', link: '/over/' },
    { tekst: 'Contact', link: '/contact/', knop: true },
  ],
} as const;

// Hulpje: is een waarde nog een plaatshouder?
export const ingevuld = (waarde: string) => waarde !== '' && waarde !== 'nog invullen';
