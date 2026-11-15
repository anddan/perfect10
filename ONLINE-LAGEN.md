# Online-lägen i Perfect 10 (idéer, inte byggt än)

Det här är en plan för att spela mot eller med andra. Inget av det här finns i spelet än.

## Hur man kommer dit (menyn)

En ny sida i boken, **Online**, efter Endless.

```
Online
 ├─ Spela med en vän
 │    ├─ Skapa rum   → du får en kod, och väljer läge
 │    └─ Skriv in kod → du går med i kompisens rum
 └─ Snabbmatch (matchmaking)
      └─ Välj läge → kö → match

Lägen: Survival · Battle · CO-OP
```

- **Vän-vägen:** den som skapar rummet väljer läge. Kompisen ser vilket det är när den går med.
- **Snabbmatch:** man väljer läge först, eftersom varje läge har sin egen kö.
- Alla tre lägen finns i båda vägarna. Rum, nedräkning, resultat och topplista byggs bara en gång.
- Kostnad: gratis i början (inga nycklar), så att det blir lätt att få ihop matcher. Inte bestämt.

## Gemensam teknik

- Firebase finns redan (projektet `perfect10-190ed`). Spelreglerna är rena och deterministiska, och dagens utmaning använder redan en seed, så **samma seed = exakt samma siffror**.
- Ett rum är ett dokument med en kod på fem tecken, en seed, ett läge och spelarna. Båda startar på en gemensam nedräkning (serverns tid).
- Går någon ur i mer än 10 sekunder räknas det som att den gett upp. Rummet går ut efter en stund.
- Mellan vänner litar vi på resultatet som spelarna skickar. Mot främlingar och på topplistor behövs skydd mot fusk (se Online-matchning).

## 1. Survival

Den som överlever längst vinner. Båda får **exakt samma siffror** (samma seed). Lika: mest poäng vinner.

- Svårighetsgraden är **tidsstyrd**, inte styrd av antal perfect 10. Annars får den som spelar bäst snabbare siffror, och då är det inte samma förutsättningar.
- Man ser kompisens läge live i ett litet fält högst upp (levande koppar och nivå). Inte beslutat om det ska vara med.
- Det minsta att bygga. Kommer först.

## 2. Battle (med dragkamp och sabotage)

En kraftigt förenklad Endless där man **skickar siffror till motståndaren**. Dragkamp och sabotage är en del av Battle, inte ett eget läge.

**Kast**
- Varje perfect 10 ger en laddning. Man kan **kasta vilken siffra man vill** på motståndaren genom att dra den uppåt mot en "skicka"-knapp, innan den hamnar i en kopp.
- Man väljer själv: en dålig siffra, eller en elak 8:a mot motståndarens fulla kopp.
- En combo ger fler laddningar.
- Mottagaren ser en liten ruta högst upp en sekund innan siffran faller, och kan **dubbeltrycka för att kasta tillbaka** den (bumerang).

**Dragkamp**
- En gemensam stapel. Varje perfect 10 skjuter den mot motståndaren, och motståndarens skjuter tillbaka. Den som får den hela vägen vinner. Man kan också vinna genom att motståndaren får en siffra i en död kopp.

**Sabotage**
- Bonusbollar man plockar kan skjutas mot motståndaren: spöke, dimma, is, eller en kopp som låses en stund. Det ger mer kaos, och kommer efter att kast och dragkamp fungerar.

**Förenklat läge:** inga perks och ingen tonande framsteg, bara kopparna och siffrorna (och sabotage som tillval).

Enklare alternativ: varje perfect 10 skickar en siffra automatiskt. Mindre taktik, så kastet är förstahandsvalet.

## 3. CO-OP (Together)

Två spelare, **två koppar var** och en gemensam ström av siffror: fyra kolumner, två på varje sida. Man överlever tillsammans så länge det går.

- Man kan **kasta en siffra till partnern** (samma dragning som i Battle) om ens egna koppar är fulla. Det gör att man spelar tillsammans.
- Laget förlorar när en siffra hamnar i en död kopp, hos någon av er.
- Resultatet (hur länge laget överlevde) går in på en **lagtopplista** i Firebase, med båda namnen.
- Namnet "CO-OP" (undertitel "Together").
- **Öppen fråga:** två telefoner via kod (rekommenderat, passar topplistan) eller en telefon där man sitter bredvid varandra?

## Online-matchning (efter vän-lägena)

- **Kö:** en per läge. När två väntar skapas ett rum, och allt efter det är som vän-läget.
- **Få spelare:** Survival kan matchas mot en **inspelad körning** av en annan spelare (samma seed), så det fungerar även när ingen är online. Battle och CO-OP kräver människor i realtid: tidsgräns i kön, sedan bot eller förslag att bjuda in en vän.
- **Fusk:** spelet är deterministiskt, så man kan spara varje spelares tryck och köra om dem på en server. Det kräver Firebase Functions (betald plan, Blaze) och troligen anonym inloggning.
- **Chatt:** ingen fri chatt, bara färdiga reaktioner.
- **Namn:** filter mot fula ord.
- **Rank:** en enkel rankning per läge, senare.

## Fler idéer (inte valda)

- **Sprint:** först till 10 perfect 10 vinner (1–2 minuter, bra för snabbmatch).
- **Tidsrace:** 90 sekunder, flest perfect 10 vinner.
- **Utmana en vän (asynkront):** spela en bana, skicka en länk, kompisen spelar samma siffror när den vill.
- **Veckans bana:** alla spelar samma seed hela veckan, med veckotopplista.
- **Stafett (CO-OP):** man spelar efter varandra, 30 sekunder var, på samma bräde.
- **Boss (CO-OP):** tre minuter, ett gemensamt mål (till exempel 40 perfect 10), vågor av svåra siffror.
- **Delade koppar:** båda ser samma fyra koppar, den som trycker först på en siffra tar den. Kräver en server som avgör vem som var först, så det blir tungt.
- **Modifierare:** till exempel "Reversed" (de omvända färgerna) som tillval på vilket läge som helst.

## Ordning att bygga i

1. Sidan **Online** med vän-vägen och **Survival** (skapa rum, kod, synkad start, resultat).
2. **CO-OP** och **Battle** med vän (de delar kast-funktionen).
3. **Snabbmatch** (kö per läge, inspelade körningar för Survival).
4. **Rank och skydd mot fusk** (Functions).

## Öppna frågor

- CO-OP: en eller två telefoner? två telefoner till att börja med.
- Battle: kast med dragning (rekommenderat) eller automatisk skickning? dragning
- Survival: ska man se kompisens läge live? nej
- Ska online-matcher kosta en nyckel, eller vara gratis? ja en nyckel
- Är det okej att uppgradera Firebase till Blaze senare, för skydd mot fusk? ja
