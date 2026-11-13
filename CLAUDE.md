# Perfect 10

Ett mattespel för mobil i stående läge. Fyra kaffekoppar som man drar runt på ett skolbänk-skrivbord
i ett nedtonat klassrum. Siffror faller i fyra kolumner. Tryck på en siffra så faller den i närmaste
levande kopp. Nå exakt 10 för level up, gå över 10 så dör koppen, och en siffra i en död kopp är game over.

Kort om reglerna:
- Svara på svenska. Gör exakt det som ombeds; ändra inte utseende, färger eller upplägg på eget bevåg.
- Committa eller deploya aldrig utan att bli ombedd.
- Säg alltid vad som är testat och vad användaren behöver testa själv.

Så hänger det ihop:
- `src/game/` är spelreglerna, ren logik utan DOM och canvas (testas med vitest, `npm test`).
  `engine.ts` äger tillståndet och skickar `GameEvent` som gränssnittet lyssnar på.
- `src/ui/` ritar på en canvas (`render.ts`, `background.ts`, `fx.ts`), spelar ljud (`audio.ts`)
  och tar emot pekare (`GameCanvas.tsx`). Spelets logiska yta är 360 x 640 och skalas till skärmen.
- Samma uppsättning som Forza Manager: Vite + React + TypeScript + vitest, Firebase Hosting,
  `version.json` per bygge så att en installerad app hämtar nya versioner själv.
