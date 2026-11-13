// Content collection "paginas": alle Markdown-bestanden in src/content/paginas/.
// De bestandsnaam (zonder .md) bepaalt het adres: over.md -> /over/, home.md -> /.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blok = z.object({ kop: z.string(), tekst: z.string() });

const paginas = defineCollection({
  loader: glob({ base: './src/content/paginas', pattern: '**/*.md' }),
  schema: z.object({
    titel: z.string(),          // tabtitel en zoekmachines
    beschrijving: z.string(),   // meta description
    kop: z.string(),            // de h1 op de pagina
    intro: z.string().optional(),
    tegels: z
      .array(
        z.object({
          titel: z.string(),
          tekst: z.string(),
          link: z.string(),
          linktekst: z.string(),
        }),
      )
      .optional(),
    knop: z.object({ tekst: z.string(), link: z.string() }).optional(),

    // Alleen de homepage gebruikt de velden hieronder.
    zoekknop: z.string().optional(),
    vragen: blok
      .extend({ lijst: z.array(z.object({ vraag: z.string(), tekst: z.string() })) })
      .optional(),
    gratis: blok.optional(),
    herkomst: blok.optional(),
    bureau: blok.optional(),
  }),
});

export const collections = { paginas };
