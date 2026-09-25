# PostimDSH

Detyrat e shtëpisë, sipas lëndëve. Gjithçka menaxhohet nga faqja **Menaxho**, në telefon ose në kompjuter, me **përdorues dhe fjalëkalim**. Nuk të duhet asnjë rresht kod.

---

## 1. Hapja e faqes (vetëm një herë, në kompjuter)

1. Hap [github.com](https://github.com) dhe hyr në llogari (ose krijo një falas).
2. Lart djathtas **+** → **New repository**. Emri: `detyrat`. Zgjidh **Public** → **Create repository**.
3. Kliko **uploading an existing file** dhe tërhiq brenda **gjithçka** nga kjo dosje.
   - Në Mac, dosja `.github` është e fshehur. Shtyp **Cmd + Shift + .** në Finder që të duket.
4. **Commit changes**.
5. **Settings** → **Pages** → te **Source** zgjidh **GitHub Actions**.
6. **Actions** → **Publiko faqen** → **Run workflow**.
7. Pas 1–2 minutash faqja është gati: `https://EMRI-YT.github.io/detyrat/`

## 2. Konfigurimi i Menaxho (vetëm një herë)

1. Hap `https://EMRI-YT.github.io/detyrat/menaxho.html`.
2. Ndiq hapat në ekran: bëj një **çelës GitHub** dhe ngjite.
3. Zgjidh **përdoruesin** dhe **fjalëkalimin** për Menaxho → **Ruaj**.

Nga ky moment hyn vetëm me përdorues dhe fjalëkalim, nga çdo pajisje. Në telefon: menyja e shfletuesit → **Shto në ekranin kryesor**.

---

## Siguria

- Çelësi i GitHub, i vetmi që lejon ndryshime në faqe, ruhet te `faqja/hyrja.json` **i enkriptuar** me AES-256. Mund ta hapë vetëm ai që di përdoruesin dhe fjalëkalimin.
- Fjalëkalimi **nuk shkruhet askund**, as në kod, as në GitHub. Prandaj leximi ose ndryshimi i kodit të faqes nuk jep asnjë leje.
- Çdo provë fjalëkalimi kërkon 600 000 llogaritje, kështu që hamendësimi me mijëra prova bëhet shumë i ngadaltë.
- **Ndrysho fjalëkalimin:** Menaxho → **Cilësimet** → **Ndrysho përdoruesin ose fjalëkalimin**.
- **Mendon se e mori vesh dikush fjalëkalimin?** Ndërroje, dhe te GitHub fshi çelësin e vjetër ([github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)). Pastaj Menaxho → **Çelësi i GitHub ka skaduar?** → vendos një të ri. Kështu dalin të gjithë nga të gjitha pajisjet.

---

## Përdorimi i përditshëm (nga faqja Menaxho)

| Dua të… | Si |
|---|---|
| Postoj detyrë | **Posto** → lënda → kur u dha (Sot/Dje/data) → përshkrim (s'është e detyrueshme) → Libri/Fletore → fotot → **Posto** |
| Postoj nga kompjuteri | Si më lart. Fotot mund t'i tërheqësh direkt nga dosja, ose të ngjitësh një screenshot me **Ctrl+V** |
| Shtoj foto te një detyrë që ekziston | **Postimet** → lënda → **+ Foto** |
| Fshij një postim | **Postimet** → lënda → **Fshi** |
| Shtoj lëndë të re | **Postimet** → poshtë, **Shto lëndë të re** |
| Ndryshoj orarin | **Orari** → hiq me ✕ ose shto me **+ Shto** → **Ruaj orarin** |
| Vendos çelës të ri GitHub (kur i kalon afati) | Hyrja → **Çelësi i GitHub ka skaduar?** |

Pas çdo ndryshimi faqja përditësohet vetë për rreth 1–2 minuta. Në Menaxho e sheh kur mbaron.

## Çfarë bëhet vetë

- **Afati:** nga orari faqja llogarit për kur është detyra ("Për nesër", "Për të hënën").
- **E kaluar:** kur postohet detyrë e re, ose kur kalon dita e mësimit, e vjetra shënohet vetë **E kaluar**.
- **Fotot:** kthehen drejt, zvogëlohen për telefonat e dobët dhe mbeten të qarta për zmadhim ose shkarkim. Formatet: jpg, png, webp, heic (iPhone), avif, gif, bmp, tiff.

## Logoja e shkollës

Te GitHub hap dosjen `faqja` → **Add file** → **Upload files** → ngarko logon me emrin **`logo.png`**.
