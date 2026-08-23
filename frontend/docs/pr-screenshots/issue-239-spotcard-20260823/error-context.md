# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scratch/spotcard-screens.spec.ts >> spotcard desktop and mobile screenshots
- Location: tests/scratch/spotcard-screens.spec.ts:18:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('a[href="#/excursions"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e5]:
      - button "Als App installierbar" [ref=e6] [cursor=pointer]
      - button "Hinweis schließen" [ref=e9] [cursor=pointer]
    - generic [ref=e13]:
      - link "Reisotor Logo Reisotor" [ref=e14] [cursor=pointer]:
        - /url: /
        - img "Reisotor Logo" [ref=e15]
        - generic [ref=e16]: Reisotor
      - button "Sommerurlaub Lissabon" [ref=e18] [cursor=pointer]
      - generic "e2e-user2 ist gerade offline" [ref=e23]: 👩
      - button "Benachrichtigungen" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: 🔔
      - generic "Erscheinungsbild" [ref=e27]:
        - generic: 🖥️
        - combobox "Erscheinungsbild" [ref=e28] [cursor=pointer]:
          - option "☀️ Hell"
          - option "🌙 Dunkel"
          - option "🖥️ Systemeinstellung" [selected]
      - link "🧑" [ref=e29] [cursor=pointer]:
        - /url: /profile
  - navigation [ref=e31]:
    - generic [ref=e32]:
      - link "Übersicht" [ref=e33] [cursor=pointer]:
        - /url: /
        - generic [ref=e34]: 🏠
      - link "Listen" [ref=e36] [cursor=pointer]:
        - /url: /listen
        - generic [ref=e37]: 📋
      - link "Karte" [ref=e40] [cursor=pointer]:
        - /url: /excursions
        - generic [ref=e41]: 🗺️
      - link "Budget" [ref=e44] [cursor=pointer]:
        - /url: /budget
        - generic [ref=e45]: 💶
      - link "Tagebuch" [ref=e48] [cursor=pointer]:
        - /url: /diary
        - generic [ref=e49]: 📔
      - link "Notizen" [ref=e52] [cursor=pointer]:
        - /url: /notes
        - generic [ref=e53]: 📝
  - generic [ref=e56]:
    - generic [ref=e57]:
      - generic [ref=e58]:
        - 'button "Maximieren: Kalender" [ref=e59] [cursor=pointer]'
        - 'button "Schließen: Kalender" [ref=e65] [cursor=pointer]'
        - generic [ref=e70]:
          - heading "Kalender" [level=2] [ref=e71]
          - generic [ref=e72]:
            - generic [ref=e74]:
              - button "Woche" [ref=e76] [cursor=pointer]
              - button "2 Wochen" [ref=e78] [cursor=pointer]
              - button "Monat" [pressed] [ref=e80] [cursor=pointer]
            - generic [ref=e82]:
              - button "Vorherige Wochen" [ref=e83] [cursor=pointer]: ‹
              - generic [ref=e84]: August 2026
              - button "Nächste Wochen" [ref=e85] [cursor=pointer]: ›
            - generic [ref=e86]:
              - button "Heute" [ref=e87] [cursor=pointer]
              - button "Urlaub" [ref=e91] [cursor=pointer]
              - button "Neu" [ref=e98] [cursor=pointer]
          - generic [ref=e100]:
            - generic [ref=e101]:
              - generic [ref=e103] [cursor=pointer]:
                - generic [ref=e104]: Mo
                - generic [ref=e105]: "27"
              - generic [ref=e107] [cursor=pointer]:
                - generic [ref=e108]: Di
                - generic [ref=e109]: "28"
              - generic [ref=e111] [cursor=pointer]:
                - generic [ref=e112]: Mi
                - generic [ref=e113]: "29"
              - generic [ref=e115] [cursor=pointer]:
                - generic [ref=e116]: Do
                - generic [ref=e117]: "30"
              - generic [ref=e119] [cursor=pointer]:
                - generic [ref=e120]: Fr
                - generic [ref=e121]: "31"
              - generic [ref=e123] [cursor=pointer]:
                - generic [ref=e124]: Sa
                - generic [ref=e125]: "1"
              - generic [ref=e127] [cursor=pointer]:
                - generic [ref=e128]: So
                - generic [ref=e129]: "2"
            - generic [ref=e130]:
              - generic [ref=e132] [cursor=pointer]:
                - generic [ref=e133]: Mo
                - generic [ref=e134]: "3"
              - generic [ref=e136] [cursor=pointer]:
                - generic [ref=e137]: Di
                - generic [ref=e138]: "4"
              - generic [ref=e140] [cursor=pointer]:
                - generic [ref=e141]: Mi
                - generic [ref=e142]: "5"
              - generic [ref=e144] [cursor=pointer]:
                - generic [ref=e145]: Do
                - generic [ref=e146]: "6"
              - generic [ref=e148] [cursor=pointer]:
                - generic [ref=e149]: Fr
                - generic [ref=e150]: "7"
              - generic [ref=e152] [cursor=pointer]:
                - generic [ref=e153]: Sa
                - generic [ref=e154]: "8"
              - generic [ref=e156] [cursor=pointer]:
                - generic [ref=e157]: So
                - generic [ref=e158]: "9"
            - generic [ref=e159]:
              - generic [ref=e161] [cursor=pointer]:
                - generic [ref=e162]: Mo
                - generic [ref=e163]: "10"
              - generic [ref=e165] [cursor=pointer]:
                - generic [ref=e166]: Di
                - generic [ref=e167]: "11"
              - generic [ref=e169] [cursor=pointer]:
                - generic [ref=e170]: Mi
                - generic [ref=e171]: "12"
              - generic [ref=e173] [cursor=pointer]:
                - generic [ref=e174]: Do
                - generic [ref=e175]: "13"
              - generic [ref=e177] [cursor=pointer]:
                - generic [ref=e178]: Fr
                - generic [ref=e179]: "14"
              - generic [ref=e181] [cursor=pointer]:
                - generic [ref=e182]: Sa
                - generic [ref=e183]: "15"
              - generic [ref=e185] [cursor=pointer]:
                - generic [ref=e186]: So
                - generic [ref=e187]: "16"
            - generic [ref=e188]:
              - generic [ref=e190] [cursor=pointer]:
                - generic [ref=e191]: Mo
                - generic [ref=e192]: "17"
              - generic [ref=e194] [cursor=pointer]:
                - generic [ref=e195]: Di
                - generic [ref=e196]: "18"
              - generic [ref=e198] [cursor=pointer]:
                - generic [ref=e199]: Mi
                - generic [ref=e200]: "19"
              - generic [ref=e202] [cursor=pointer]:
                - generic [ref=e203]: Do
                - generic [ref=e204]: "20"
              - generic [ref=e206] [cursor=pointer]:
                - generic [ref=e207]: Fr
                - generic [ref=e208]: "21"
              - generic [ref=e210] [cursor=pointer]:
                - generic [ref=e211]: Sa
                - generic [ref=e212]: "22"
                - 'generic "Urlaubsort: Klar" [ref=e214]':
                  - generic [ref=e215]: 🏖️
                  - text: 25°
              - generic [ref=e217] [cursor=pointer]:
                - generic [ref=e218]: So
                - generic [ref=e219]: "23"
                - 'generic "Urlaubsort: Starker Nieselregen" [ref=e221]':
                  - generic [ref=e222]: 🏖️
                  - text: 23°
            - generic [ref=e223]:
              - generic [ref=e225] [cursor=pointer]:
                - generic [ref=e226]: Mo
                - generic [ref=e227]: "24"
                - 'generic "Urlaubsort: Leichter Regen" [ref=e229]':
                  - generic [ref=e230]: 🏖️
                  - text: 23°
              - generic [ref=e232] [cursor=pointer]:
                - generic [ref=e233]: Di
                - generic [ref=e234]: "25"
                - 'generic "Urlaubsort: Leichter Nieselregen" [ref=e236]':
                  - generic [ref=e237]: 🏖️
                  - text: 24°
              - generic [ref=e239] [cursor=pointer]:
                - generic [ref=e240]: Mi
                - generic [ref=e241]: "26"
                - 'generic "Urlaubsort: Starker Nieselregen" [ref=e243]':
                  - generic [ref=e244]: 🏖️
                  - text: 24°
              - generic [ref=e246] [cursor=pointer]:
                - generic [ref=e247]: Do
                - generic [ref=e248]: "27"
                - 'generic "Urlaubsort: Leichter Nieselregen" [ref=e250]':
                  - generic [ref=e251]: 🏖️
                  - text: 22°
              - generic [ref=e253] [cursor=pointer]:
                - generic [ref=e254]: Fr
                - generic [ref=e255]: "28"
                - 'generic "Urlaubsort: Teilweise bewölkt" [ref=e257]':
                  - generic [ref=e258]: 🏖️
                  - text: 25°
              - generic [ref=e260] [cursor=pointer]:
                - generic [ref=e261]: Sa
                - generic [ref=e262]: "29"
                - 'generic "Urlaubsort: Klar" [ref=e264]':
                  - generic [ref=e265]: 🏖️
                  - text: 26°
              - generic [ref=e267] [cursor=pointer]:
                - generic [ref=e268]: So
                - generic [ref=e269]: "30"
                - 'generic "Urlaubsort: Überwiegend klar" [ref=e271]':
                  - generic [ref=e272]: 🏖️
                  - text: 27°
            - generic [ref=e273]:
              - generic [ref=e275] [cursor=pointer]:
                - generic [ref=e276]: Mo
                - generic [ref=e277]: "31"
                - 'generic "Urlaubsort: Überwiegend klar" [ref=e279]':
                  - generic [ref=e280]: 🏖️
                  - text: 27°
              - generic [ref=e282] [cursor=pointer]:
                - generic [ref=e283]: Di
                - generic [ref=e284]: "1"
                - 'generic "Urlaubsort: Klar" [ref=e286]':
                  - generic [ref=e287]: 🏖️
                  - text: 25°
              - generic [ref=e289] [cursor=pointer]:
                - generic [ref=e290]: Mi
                - generic [ref=e291]: "2"
                - 'generic "Urlaubsort: Klar" [ref=e293]':
                  - generic [ref=e294]: 🏖️
                  - text: 26°
              - generic [ref=e296] [cursor=pointer]:
                - generic [ref=e297]: Do
                - generic [ref=e298]: "3"
                - 'generic "Urlaubsort: Klar" [ref=e300]':
                  - generic [ref=e301]: 🏖️
                  - text: 24°
              - generic [ref=e303] [cursor=pointer]:
                - generic [ref=e304]: Fr
                - generic [ref=e305]: "4"
                - 'generic "Urlaubsort: Bedeckt" [ref=e307]':
                  - generic [ref=e308]: 🏖️
                  - text: 25°
              - generic [ref=e310] [cursor=pointer]:
                - generic [ref=e311]: Sa
                - generic [ref=e312]: "5"
                - 'generic "Urlaubsort: Leichter Nieselregen" [ref=e314]':
                  - generic [ref=e315]: 🏖️
                  - text: 24°
              - generic [ref=e316] [cursor=pointer]:
                - generic [ref=e317]:
                  - generic [ref=e318]: So
                  - generic [ref=e319]: "6"
                  - 'generic "Urlaubsort: Leichter Nieselregen" [ref=e321]':
                    - generic [ref=e322]: 🏖️
                    - text: 25°
                - generic "Hotel Alfama" [ref=e323]:
                  - generic [ref=e324]: 🛏️
                  - text: Hotel Alfama
                - generic [ref=e325]:
                  - generic "Hinflug nach Lissabon" [ref=e326]:
                    - generic [ref=e327]: ✈️
                    - text: Hinflug nach Lissabon
                  - 'generic "Urlaub-Start: Sommerurlaub Lissabon" [ref=e328]':
                    - generic [ref=e329]: 🧳
                    - text: "Urlaub-Start: Sommerurlaub Lissabon"
          - generic [ref=e330]:
            - generic [ref=e331]:
              - heading "Sonntag, 23. August" [level=3] [ref=e332]
              - button "Tag auf Karte anzeigen" [ref=e334] [cursor=pointer]:
                - generic [ref=e335]: 🗺️
                - text: Tag auf Karte anzeigen
            - paragraph [ref=e336]:
              - generic [ref=e337]: 🏖️
              - text: "Urlaubsort:"
              - generic [ref=e338]: 🌧️
              - text: 23° / 19°
              - generic [ref=e339]: · 100%
            - list [ref=e342]:
              - listitem [ref=e343]: Noch keine Termine an diesem Tag.
      - separator "Breite von Kalender anpassen" [ref=e344]
    - main [ref=e345]:
      - generic [ref=e346]:
        - generic [ref=e347]:
          - button "Bearbeiten" [ref=e348] [cursor=pointer]
          - heading "Sommerurlaub Lissabon" [level=1] [ref=e352]
          - paragraph [ref=e353]: Lissabon, Portugal
          - paragraph [ref=e357]: 06.09 – 16.09
          - paragraph [ref=e358]: Noch 14 Tage bis zur Abreise 🎒
        - generic [ref=e359]:
          - heading "Wetter" [level=3] [ref=e360]
          - generic [ref=e364]:
            - generic [ref=e365]: Heute in Lissabon, Portugal
            - generic [ref=e366]: 🌧️
            - generic [ref=e367]: 23° / 19°
            - generic [ref=e368]: 100%
          - paragraph [ref=e371]: Wetter im Urlaub
          - generic [ref=e378]:
            - generic [ref=e379]:
              - generic [ref=e380]: So, 06.09
              - generic [ref=e381]: 🌧️
              - generic [ref=e382]: 25° / 19°
              - generic [ref=e383]: 2%
            - generic [ref=e386]:
              - generic [ref=e387]: Mo, 07.09
              - generic [ref=e388]: 🌡️
              - generic [ref=e389]: 0° / 0°
          - 'link "Quelle: Open-Meteo (ECMWF (Europa, empfohlen)) · Anbieter wechseln" [ref=e390] [cursor=pointer]':
            - /url: /profile?tab=trip#weather-provider-settings
          - paragraph [ref=e391]: Markiere in der Karte unter Spots einen Spot mit „Zuhause“, um hier zusätzlich das Wetter zuhause gegen Ende des Urlaubs zu sehen.
        - generic [ref=e396]:
          - 'button "Kalender 06.09 — Hinflug nach Lissabon 06.09 — Urlaub-Start: Sommerurlaub Lissabon 07.09 · 19:30 — Abendessen im Time Out Market" [ref=e397] [cursor=pointer]':
            - generic [ref=e398]: 📅
            - heading "Kalender" [level=3] [ref=e399]
            - list [ref=e400]:
              - listitem [ref=e401]:
                - generic [ref=e403]: 06.09 — Hinflug nach Lissabon
              - listitem [ref=e404]:
                - generic [ref=e406]: "06.09 — Urlaub-Start: Sommerurlaub Lissabon"
              - listitem [ref=e407]:
                - generic [ref=e409]: 07.09 · 19:30 — Abendessen im Time Out Market
          - 'link "Packliste Gepackt 1 / 6 🧑 Meine Liste: 0/2 👩 e2e-user2: 0/2 🤝 Gemeinsam: 1/2" [ref=e410] [cursor=pointer]':
            - /url: /listen?tab=packing
            - generic [ref=e411]: 🧳
            - heading "Packliste" [level=3] [ref=e412]
            - generic [ref=e414]:
              - generic [ref=e416]: Gepackt
              - generic [ref=e417]:
                - strong [ref=e418]: "1"
                - text: / 6
            - list [ref=e421]:
              - listitem [ref=e422]: "🧑 Meine Liste: 0/2"
              - listitem [ref=e423]: "👩 e2e-user2: 0/2"
              - listitem [ref=e424]: "🤝 Gemeinsam: 1/2"
          - link "Budget Ausgegeben 997.40 € / 1730.00 €" [ref=e425] [cursor=pointer]:
            - /url: /budget
            - generic [ref=e426]: 💶
            - heading "Budget" [level=3] [ref=e427]
            - generic [ref=e429]:
              - generic [ref=e431]: Ausgegeben
              - generic [ref=e432]:
                - strong [ref=e433]: 997.40 €
                - text: / 1730.00 €
          - link "Einkaufsliste Gekauft 1 / 3" [ref=e436] [cursor=pointer]:
            - /url: /listen?tab=shopping
            - generic [ref=e437]: 🛒
            - heading "Einkaufsliste" [level=3] [ref=e438]
            - generic [ref=e440]:
              - generic [ref=e442]: Gekauft
              - generic [ref=e443]:
                - strong [ref=e444]: "1"
                - text: / 3
          - link "ToDo Erledigt 0 Kein Ziel gesetzt" [ref=e447] [cursor=pointer]:
            - /url: /listen?tab=todo
            - generic [ref=e448]: 📋
            - heading "ToDo" [level=3] [ref=e449]
            - generic [ref=e450]:
              - generic [ref=e451]:
                - generic [ref=e453]: Erledigt
                - strong [ref=e455]: "0"
              - paragraph [ref=e458]: Kein Ziel gesetzt
          - link [ref=e459] [cursor=pointer]:
            - /url: /excursions?group=tours
            - generic [ref=e460]: ✈️
            - heading "Reise" [level=3] [ref=e461]
            - paragraph [ref=e462]: 06.09 — Hinflug nach Lissabon
          - link [ref=e463] [cursor=pointer]:
            - /url: /excursions#spot-1
            - generic [ref=e464]: 🛏️
            - heading "Unterkunft" [level=3] [ref=e465]
            - paragraph [ref=e466]: Hotel Alfama · 06.09
          - link [ref=e467] [cursor=pointer]:
            - /url: /diary
            - generic [ref=e468]: 📔
            - heading "Tagebuch" [level=3] [ref=e469]
            - paragraph [ref=e470]: 1 Eintrag · zuletzt 23.08
          - link [ref=e471] [cursor=pointer]:
            - /url: /notes
            - generic [ref=e472]: 📝
            - heading "Notizen" [level=3] [ref=e473]
            - paragraph [ref=e474]: 1 Notiz
          - link [ref=e475] [cursor=pointer]:
            - /url: /security-check
            - generic [ref=e476]: 🛡️
            - heading "Sicherheits-Check" [level=3] [ref=e477]
            - paragraph [ref=e478]: Der Reisotor scannt eure Reiseregion 🤖🔍
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { forceFontDisplayBlock } from '../helpers/fonts';
  3  | 
  4  | // Scratch spec: navigate to Spots list (ExcursionsView) and capture SpotCard mini + expanded
  5  | // states in desktop and mobile viewports. Saves screenshots into frontend/docs/pr-screenshots/<slug>/
  6  | 
  7  | const outDir = '../../frontend/docs/pr-screenshots/issue-239-spotcard-20260823';
  8  | 
  9  | test.beforeEach(async ({ page }) => {
  10 |   await forceFontDisplayBlock(page);
  11 | });
  12 | 
  13 | async function capture(page, name: string) {
  14 |   await page.waitForTimeout(500); // small wait for animations
  15 |   await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  16 | }
  17 | 
  18 | test('spotcard desktop and mobile screenshots', async ({ page, browserName }) => {
  19 |   // start app (e2e global-setup normally does backend+frontend). Assumes default test config.
  20 |   await page.goto('/');
  21 |   // ensure logged in (seed demo user flow is normally automatic in e2e suite)
  22 |   await page.waitForSelector('main');
  23 | 
  24 |   // navigate to Excursions/Spots view
> 25 |   await page.click('a[href="#/excursions"]');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  26 |   await page.waitForSelector('.spots-col-body');
  27 | 
  28 |   // desktop: 1280x800
  29 |   await page.setViewportSize({ width: 1280, height: 800 });
  30 |   await page.waitForTimeout(300);
  31 |   // mini card: capture first .spot-card in list
  32 |   const firstCard = await page.locator('.spot-card').first();
  33 |   await firstCard.scrollIntoViewIfNeeded();
  34 |   await capture(page, 'desktop-spotcard-mini');
  35 | 
  36 |   // expanded: click to open
  37 |   await firstCard.click();
  38 |   await page.waitForTimeout(300);
  39 |   await capture(page, 'desktop-spotcard-expanded');
  40 | 
  41 |   // mobile viewport
  42 |   await page.setViewportSize({ width: 390, height: 844 });
  43 |   await page.waitForTimeout(300);
  44 |   // ensure spot list visible on mobile - navigate if needed
  45 |   // capture mini
  46 |   const firstCardMobile = await page.locator('.spot-card').first();
  47 |   await firstCardMobile.scrollIntoViewIfNeeded();
  48 |   await capture(page, 'mobile-spotcard-mini');
  49 | 
  50 |   // expanded mobile
  51 |   await firstCardMobile.click();
  52 |   await page.waitForTimeout(300);
  53 |   await capture(page, 'mobile-spotcard-expanded');
  54 | });
  55 | 
```