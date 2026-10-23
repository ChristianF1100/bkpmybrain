# bkpmybrain

Sito personale **statico** (GitHub Pages) la cui navigazione è una **rete neurale 3D**: ogni contenuto è un nodo, i tag creano le sinapsi, e la luminosità segue le **date di pubblicazione** (decadimento nel tempo + propagazione lungo i collegamenti).

Stack: Astro 5 (pagine statiche) · React + TypeScript · Three.js / React Three Fiber / Drei · Markdown/MDX · GitHub Actions.
Nessun backend, database, servizio esterno, login o CMS. Tutto (rendering, ricerca, calcolo dell'attività) gira nel browser; collegamenti, coordinate e indice di ricerca sono calcolati **in build**.

## 1. Installazione locale

Serve Node **≥ 22.18** (gli script di build sono TypeScript eseguito direttamente da Node; vedi `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:4321 — si rigenera da solo quando cambi content/ o config/
```

Altri comandi: `npm run validate` (controlla i contenuti, non scrive nulla) · `npm test` · `npm run build` (sito in `dist/`) · `npm run preview` · `npm run simulate` (mostra l'attività di ogni argomento oggi, tra 1, 3, 6 e 12 mesi) · `npm run lock-layout`.

Dopo il primo `npm install` fai il commit di `package-lock.json`.

## 2. Aggiungere un contenuto

```bash
npm run new -- article "Titolo dell'articolo" --tags fpv,elettronica
npm run new -- fragment --tags pensieri          # frammento senza titolo
```

oppure copia `content/_templates/esempio-completo.mdx` (documenta ogni campo). Un file in `content/` produce **da solo** pagina, nodo 3D, collegamenti e voce nell'indice di ricerca.

```yaml
---
id: 20261014-riparazione-drone     # OBBLIGATORIO e stabile: è l'identità del nodo (non cambiarlo)
type: article                       # article | note | fragment | project | photo | video | code | memory | mixed
title: Un titolo                    # facoltativo (frammenti senza titolo ammessi)
date: 2026-10-14                    # pubblicazione: guida la luminosità
tags: [fpv, elettronica, riparazioni]
description: Estratto per anteprima e SEO   # se manca, si usa l'inizio del testo
---
```

| Vuoi… | Fai così |
|---|---|
| **Bozza** | `draft: true` — non finisce nel sito pubblico |
| **Pubblicazione programmata** | `date:` futura — compare quando arriva il giorno (la build notturna in `deploy.yml` la pubblica da sola) |
| **Modificare** | cambia il file, mantieni `id` e (se l'hai fissato) `slug` |
| **Eliminare** | cancella il file: nodo, pagina e collegamenti spariscono. Gli altri nodi **non si spostano** |
| **Slug** | default = titolo (o `id` se senza titolo); `slug:` per forzarlo. Gli slug duplicati bloccano la build con un errore chiaro |
| **Collegare due contenuti a mano** | `related: [altro-id]` |
| **Cambiare il colore del nodo** | `primary: nome-argomento` |

File e cartelle che iniziano con `_` vengono ignorati (utili per bozze personali e template).

## 3. Immagini, video, allegati

Metti i file in `public/media/<id-contenuto>/` e usali con percorsi che iniziano con `/`: **funzionano anche sotto `/nome-repo`** (il prefisso viene aggiunto in automatico, in Markdown e nei blocchi).

```mdx
![Testo alternativo](/media/20261014-riparazione-drone/foto.jpg)

<Figure src="/media/x/foto.jpg" alt="Descrizione" caption="Didascalia" />
<Gallery columns={2} images={[{ src: "/media/x/a.jpg", alt: "A" }, { src: "/media/x/b.jpg", alt: "B" }]} />
<Video src="/media/x/clip.mp4" poster="/media/x/poster.jpg" caption="…" />
<Attachment href="/media/x/scheda.pdf" label="Scheda tecnica" />
```

Il testo alternativo (`alt`) è obbligatorio: se manca, la build fallisce. I blocchi di codice usano i normali ``` ```linguaggio ``` con evidenziazione in build. (Le immagini di `public/media/` e `public/og.png` sono segnaposto dimostrativi.)

**Editor visuale a blocchi (futuro, locale):** il formato è già pronto — frontmatter descritto da `docs/content.schema.json` + corpo MDX fatto di Markdown e dei 4 blocchi sopra. Un editor locale deve solo scrivere quei file.

## 4. Argomenti, tag, sinonimi

- **Argomenti** (le regioni della rete): `config/topics.json` — id, etichetta, colore, descrizione, `aliases` (sinonimi), `position` `[x,y,z]` (raggio rete ≈ 30; assente = derivata dall'id nella fascia `zone`), collegamenti tra argomenti (`related` con peso).
- **Argomenti automatici:** un tag non definito che compare in **≥ 3 contenuti** (`autoTopicMinCount`) diventa un argomento da solo, con colore stabile.
- **Tag equivalenti** (`riparazione` = `riparazioni`): `links.equivalences` in `config/network.ts`.
- **Come nascono i collegamenti:** contenuto→argomento per ogni tag che corrisponde; contenuto↔contenuto per tag condivisi (i tag **rari** pesano di più, forza = `1 − e^(−somma·gain)`, soglia minima, **massimo 4 secondari per nodo**); collegamenti `related`; ponti argomento↔argomento (dichiarati + co-occorrenza). Niente AI esterne.

## 5. Attività neurale

Calcolata **nel browser** con la data corrente (nessun aggiornamento quotidiano del repository):

1. ogni contenuto è un impulso di ampiezza 1 nel suo nodo;
2. si propaga per al massimo **3 passaggi**, moltiplicando per `0,55 × peso^esponente` a ogni collegamento (percorso migliore);
3. decade con **emivita di 30 giorni**;
4. gli impulsi si accumulano con saturazione `1 − Π(1 − cᵢ)`: mai oltre il 100%, e pubblicare spesso su un tema lo accende di più;
5. luminosità = **8% minimo** + attività: i nodi non scompaiono mai.

La **forza strutturale** (quanti contenuti/connessioni ha accumulato un argomento) è un'altra cosa: determina la *dimensione* dei nodi, non la luminosità. Una regione vecchia ma ricca è grande e spenta; una nuova è piccola e accesa.
Tutti i parametri (`halfLifeDays`, `strongLinkPass`, `maxHops`, `minBrightness`, `weightExponent`…) sono in `config/network.ts`, insieme a palette, luci, movimento, camera, soglie click/drag, qualità grafica e densità della rete.

> La demo ha date ancorate a ottobre 2026: man mano che passano i mesi la rete si spegne da sola, mostrando il decadimento. Prova `npm run simulate`.

## 6. Stabilità della geografia

Le coordinate non dipendono dal caricamento: ogni argomento ha un'ancora (config o hash dell'id) e ogni contenuto nasce attorno al baricentro dei suoi argomenti con un generatore **seedato dall'id**. Aggiungere un contenuto recente non sposta nessun altro nodo (verificato nei test). Per congelare del tutto le posizioni attuali:

```bash
npm run lock-layout   # scrive data/layout.lock.json — fai il commit
```

I nodi bloccati non si muovono più; i nuovi si posizionano attorno a quelli esistenti. Se un tag supera la soglia degli argomenti automatici, i contenuti che lo usano possono ri-ancorarsi (se non sono bloccati).

## 7. Easter egg CrestaNord

`config/topics.json` definisce `crestanord`: regione remota, `secret: true` (etichetta visibile solo da vicino), `faint: 0.55` (più discreta). Il nodo speciale è `content/demo/crestanord.mdx` (`type: memory`, id `crestanord`): la sua pagina racconta il vecchio sito e rimanda agli articoli storici. Non compare né nell'interfaccia né nell'indice accessibile della homepage; resta raggiungibile via URL e sitemap. Per usare la tua storia vera: sostituisci testo e immagini in `content/demo/crestanord.mdx` e `public/media/crestanord/`.

## 8. Dominio personalizzato

1. In `config/site.json` imposta `"customDomain": "www.tuodominio.it"` (la build scrive da sola `public/CNAME` e usa base `/`).
2. Presso il registrar: record `CNAME` verso `<utente>.github.io` (o record `A` ai 4 IP di GitHub Pages per il dominio apex).
3. Repository → Settings → Pages → *Custom domain* e abilita *Enforce HTTPS*.

Senza dominio, `site` e `base` vengono dedotti dal repository: `https://utente.github.io/nome-repo/` → base `/nome-repo`; repository `utente.github.io` → base `/`. Override: variabili `SINAPSI_SITE` e `SINAPSI_BASE`.

## 9. Pubblicare su GitHub Pages

1. Crea il repository e carica il progetto (ramo `main`).
2. Settings → Pages → **Source: GitHub Actions**.
3. Ogni push su `main` esegue `.github/workflows/deploy.yml`: installa, **valida i contenuti**, esegue i **test**, genera rete/collegamenti/indice di ricerca, compila le pagine statiche, pubblica.
4. Per **aggiornare il sito**: modifica/aggiungi file in `content/`, `git push`. Nient'altro.

Ogni articolo è un file reale (`/contenuti/<slug>/index.html`, `trailingSlash: 'always'`, `build.format: 'directory'`): URL diretti, nessun 404 al refresh, nessun routing lato client. Sono generati anche `sitemap-index.xml`, `robots.txt`, canonical, Open Graph e JSON-LD per articolo.

## 10. Struttura

```
config/        site.json · topics.json · network.ts (tutti i parametri) · resolve-site.ts
content/       i tuoi contenuti (demo/ = esempi, eliminabile) · _templates/
data/          layout.lock.json (opzionale)
scripts/       build-data.ts (valida + genera) · new-content.ts · simulate-activity.ts
src/core/      logica pura e testata: frontmatter, contenuti, argomenti, collegamenti, layout, attività, ricerca, pipeline
src/app/       homepage React: scene/ (shader, buffer, camera, picking, etichette) · ui/ (anteprima, ricerca, guida)
src/pages/     index (rete + indice accessibile) · contenuti/[slug] (articoli) · 404 · robots
src/components/blocks/   Figure · Gallery · Video · Attachment
tests/         test automatici (node:test, senza dipendenze)
```

Prestazioni: la scena usa **4 draw call** in totale (wireframe, nuclei+aloni, filamenti, impulsi). Il movimento organico, la luminosità e gli impulsi sono calcolati nella GPU a partire da coordinate stabili e da una minuscola texture di stato (`runtime.ts`): cambiare attività, selezione o hover aggiorna poche decine di numeri, non la geometria. LOD: i dettagli interni dei nodi svaniscono con la distanza; qualità `low` per dispositivi deboli (meno segmenti/impulsi, DPR ridotto) e `PerformanceMonitor` che abbassa la risoluzione se i fotogrammi calano. `prefers-reduced-motion` ferma oscillazioni, rotazione e impulsi. Senza WebGL2 (o se la scena fallisce) la homepage mostra l'**indice dei contenuti** (che esiste comunque nell'HTML, accessibile da tastiera e dai motori di ricerca).

## 11. Test e stato delle verifiche

`npm test` esegue la suite automatica (parser del frontmatter, validazione, slug/id, bozze e date future, alias e argomenti automatici, collegamenti, tetto ai secondari, attività: emivita/propagazione/saturazione/pesi/decadimento/riattivazione, stabilità delle coordinate, ricerca, pipeline completa sui contenuti demo, buffer GPU, `base`/URL).

**Verificato in fase di sviluppo** (eseguito davvero): tutta la logica deterministica sopra; la pipeline end-to-end sui contenuti demo; lo script di creazione contenuti; la sintassi di tutti i file TSX; il typecheck strict dei moduli puri.
**Non verificato in quell'ambiente** (non aveva rete né browser con WebGL, quindi niente `npm install`, `astro build` né rendering): shader GLSL, interazioni mouse/touch (rotazione, zoom, pinch, tap), transizioni di camera, resa grafica, pagine Astro generate, workflow su GitHub. Sono scritti con cura ma vanno provati: alla prima esecuzione controlla `npm run build` e poi la lista in fondo a questo file.

### Checklist di prima esecuzione
- [ ] `npm install && npm test && npm run build` senza errori
- [ ] Desktop: rotazione (sinistro/centrale su vuoto), zoom, pan (destro o Maiusc), click ≠ trascinamento
- [ ] Smartphone: un dito ruota, pinch zooma, tap seleziona, il pannello resta leggibile
- [ ] Click su nodo → camera, attenuazione, anteprima → *Apri* → articolo → *Torna alla rete* ripristina camera e selezione
- [ ] Ricerca → la camera accompagna al nodo; refresh su `/contenuti/<slug>/` senza 404
- [ ] Sotto un sottopercorso (`SINAPSI_SITE=https://utente.github.io SINAPSI_BASE=/repo npm run build`) immagini e link funzionano
