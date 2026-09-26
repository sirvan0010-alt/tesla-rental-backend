# Kompletní plán: Tesla pronájem s bezkontaktním přístupem
### Software, hardware a provozní nastavení — Prostějov

---

## 0. Filozofie celého systému

Dvě různé priority, jeden systém:

- **Zákazník** → co nejméně kroků, co nejméně přemýšlení, funguje to i na starším telefonu, žádná instalace složitých věcí.
- **Vy jako majitel** → jistota, že víte, kdo auto má, že je pojištěné riziko kryté kaucí, a že v případě problému máte doklady i důkazy po ruce.

Řešení: **veškerá složitost běží na pozadí (backend), zákazník vidí jen 3 kroky.** To je přesně to, co je už postavené.

---

## 1. HARDWARE — co reálně potřebujete

Dobrá zpráva: díky rozhodnutí pro app-based přístup (FleetBold styl) **nepotřebujete žádný hardware navíc k autu.** Žádný keybox, žádná montáž, žádná údržba baterií v zařízení na skle.

### 1.1 Co JE potřeba

| Položka | Účel | Poznámka |
|---|---|---|
| **Tesla s aktivním Fleet API přístupem** | základ celého systému | ověřit, že model podporuje Guest Key / Fleet API (prakticky všechny novější Tesly ano) |
| **Server/hosting pro backend** | běh aplikace nepřetržitě | viz sekce 3 - stačí malý cloud server, nemusí být u vás doma |
| **Váš telefon s Tesla aplikací** | správa vozu, sledování stavu, Sentry Mode | běžná aplikace, žádný speciální hardware |
| **Stabilní připojení vozu k internetu** | Tesla musí mít LTE/WiFi signál, aby reagovala na příkazy | u novějších Tesel řeší vestavěné LTE samo, není třeba nic dokupovat |

### 1.2 Co NENÍ potřeba (a proč)

- ❌ **Keybox/keysafe** — zamítnuto dříve (nemáte kam montovat), navíc app-based přístup ho obchází úplně
- ❌ **Fyzická keycard jako primární vstup** — appka ji nahrazuje; kartu můžete mít jako záložní klíč uvnitř vozu, ale není nutná
- ❌ **Externí GPS/alarm tracker** — Tesla telemetrie (poloha, rychlost, události) už toto pokrývá přes Fleet API
- ❌ **Kamera/dashcam hardware navíc** — Tesla Sentry Mode a palubní kamery to řeší, jen k nim nemáte API přístup (viz sekce 6)

### 1.3 Volitelný hardware (doporučuji, ale ne nutný na start)

| Položka | Proč | Priorita |
|---|---|---|
| USB flash disk v autě (Sentry Mode nahrávky) | ruční zálohování klipů při podezření na incident | nízká - dokupte, až narazíte na reálný případ |
| Druhý telefon/tablet jako "admin terminál" | rychlý přístup k `admin.html` bez nutnosti brát vlastní telefon | nízká, spíš pohodlí |

**Shrnutí sekce 1:** hardwarová investice je prakticky nulová. Celý systém stojí na softwaru a na tom, že Tesla sama je dost "chytré" vozidlo.

---

## 2. SOFTWARE — kompletní přehled komponent

### 2.1 Co už je hotové (v repozitáři `tesla-rental-backend`)

```
✅ Rezervační backend (Node.js/TypeScript + Express)
✅ Databáze rezervací (PostgreSQL + Prisma) se stavy DRAFT→PENDING_PAYMENT→PAID→ACTIVE→RETURNED→SETTLED
✅ Platby (Comgate) - karty, Google Pay, konkrétní české banky, zákazník si vybírá
✅ Kauce jako pre-authorization (blokace, ne strhnutí) s možností release/capture
✅ Upload dokladů (řidičák + občanka) - nešifrované, admin má přímý přístup
✅ Admin prohlížeč dokladů (admin.html)
✅ Napojení na vytvoření přístupu k vozu po zaplacení (vehicleAccessService.ts)
✅ Automatický retry, pokud vytvoření přístupu selže
✅ Zákaznická appka (public/index.html) - 3 kroky, velké tlačítko, jednoduché
```

### 2.2 Co zbývá doplnit (v pořadí priority)

| # | Co | Proč je to důležité | Odhad práce |
|---|---|---|---|
| 1 | **Registrace u FleetBold (nebo alternativy)** | bez toho `vehicleAccessService.ts` nemá s čím komunikovat - je to zatím jen návrh podle typického API | 1-3 dny (čekání na schválení partnerství) |
| 2 | **Registrace u Comgate (produkční účet)** | teď běží jen návrh nad jejich SDK, potřebujete merchant ID | 1-2 dny |
| 3 | **Krok "výběr termínu a vozu"** | appka teď má natvrdo `DEMO-VIN-0001` a pevné částky | 0,5-1 den vývoje |
| 4 | **ACTIVE → RETURNED → SETTLED tok** | vrácení vozu, fotky, uvolnění/strhnutí kauce - klíčové pro reálný provoz | 1-2 dny vývoje |
| 5 | **Notifikace (e-mail/SMS)** | teď jen logují do konzole, zákazník nic nedostane | 0,5 dne (SendGrid + Twilio účty) |
| 6 | **Nasazení na server (hosting)** | lokální `npm run dev` nejde použít pro reálné zákazníky | 0,5-1 den |
| 7 | **HTTPS doména** | Comgate webhook i appka to vyžadují | součást bodu 6 |

Celkem realisticky **7-14 dní** do plně funkčního provozu, většina času padne na čekání na schválení u externích služeb (FleetBold, Comgate), ne na samotné programování.

---

## 3. Hosting a nasazení — detailní postup

### 3.1 Doporučená volba pro rozjezd: **Railway.app**

Proč: nasazení přímo z GitHub repozitáře na pár kliků, spravovaná PostgreSQL databáze součástí, automatické HTTPS, cena v řádu stovek Kč/měsíc při malém provozu.

**Postup:**
1. Založit účet na railway.app, propojit s GitHub účtem
2. "New Project" → "Deploy from GitHub repo" → vybrat `tesla-rental-backend`
3. Railway automaticky rozpozná Node.js projekt a spustí `npm install` + `npm run build`
4. Přidat "PostgreSQL" jako novou službu v rámci projektu - Railway sám vygeneruje `DATABASE_URL`
5. V nastavení projektu (Variables) doplnit zbylé proměnné z `.env`:
   - `COMGATE_MERCHANT_ID`, `COMGATE_SECRET`, `COMGATE_TEST=false`
   - `VEHICLE_ACCESS_API_URL`, `VEHICLE_ACCESS_API_KEY`
   - `ADMIN_API_KEY`
   - `FRONTEND_RETURN_URL`, `BACKEND_CALLBACK_URL` (doplnit skutečnou Railway/vlastní doménu)
6. Railway přidělí veřejnou HTTPS adresu automaticky (`*.up.railway.app`), volitelně napojíte vlastní doménu

### 3.2 Alternativa: vlastní VPS (vzhledem k vašemu homelab zázemí)

Máte zkušenost s Proxmox VE - vlastní VPS (Hetzner, DigitalOcean) by pro vás neměla být problém a vyjde levněji při delším provozu. Rozdíl oproti Railway: sami řešíte HTTPS certifikát (Let's Encrypt + Caddy/nginx jako reverse proxy), firewall, zálohování databáze. Doporučuji to až jako druhý krok, po ověření, že byznys funguje.

### 3.3 Doména

Koupit vlastní doménu (např. `pronajem-tesla-prostejov.cz`) u českého registrátora (Wedos, Forpsi) - cca 200-300 Kč/rok. Nasměrovat na Railway/VPS podle jejich návodu (DNS CNAME/A záznam).

---

## 4. Registrace u externích služeb — co vás čeká

### 4.1 Comgate
- Registrace na comgate.cz, k tomu IČO (pokud podnikáte jako OSVČ/s.r.o.)
- Sandbox (testovací) přístup dostanete ihned zdarma
- Produkční aktivace vyžaduje schválení - obvykle pošlou dotazník o typu podnikání
- Poplatky: obvykle % z transakce (ověřit aktuální ceník při registraci)

### 4.2 FleetBold (nebo zvolená alternativa)
- Kontaktovat jako partnera pro car-sharing/rental use case
- Budou chtít vědět: kolik vozidel, jaký model provozu (krátkodobý pronájem)
- Dostanete API klíč a přesnou dokumentaci - tou dobou upravíte `vehicleAccessService.ts` podle jejich skutečného API (v kódu je na to jasně označené místo)

### 4.3 SendGrid (e-mail) + Twilio (SMS)
- Oba mají "pay as you go" model, žádný závazek
- SendGrid: pár stovek e-mailů měsíčně zdarma, nad rámec centy za e-mail
- Twilio: nutné dokoupit kredit, SMS do ČR cca 1-2 Kč/kus

### 4.4 Právní/pojistné minimum
- **Pojištění vozu pro pronájem** - ověřit u pojišťovny, že běžná pojistka pokrývá i komerční krátkodobý pronájem (často vyžaduje speciální připojištění)
- **Obchodní podmínky** - dát si právníkem zkontrolovat texty prohlášení (střízlivost, péče o interiér, odpovědnost za škodu) - i jen jednorázová konzultace stojí za to
- **GDPR souhlas** - formální text souhlasu se zpracováním osobních údajů a dokladů, ideálně od právníka nebo šablona specificky pro ČR

---

## 5. Provozní workflow — den ze života pronajímatele

### Před spuštěním (jednorázově)
1. Vůz zaregistrovaný ve FleetBold s vaším Tesla účtem
2. Server běží, doména funguje, Comgate produkčně aktivní
3. `ADMIN_API_KEY` uložený na bezpečném místě (heslo manažer, ne poznámka v telefonu)

### Běžný týden
1. Zákazník si rezervuje termín (až bude hotový krok "výběr termínu" ze sekce 2.2)
2. Appka mu projde 3 kroky, vy nemusíte dělat nic - systém sám ověří platbu a vytvoří přístup
3. V den vyzvednutí zákazník otevře appku/odkaz, klikne "Odemknout" - vy nemusíte být fyzicky přítomen
4. Po vrácení (až bude hotovo RETURNED→SETTLED) systém sám porovná fotky a buď automaticky uvolní kauci, nebo vás upozorní na kontrolu

### Když nastane problém (poškození, spor)
1. Otevřete `admin.html`, zadáte ID rezervace + admin klíč
2. Vidíte jméno, kontakt, foto řidičáku i občanky
3. Přes `POST /kauce/:transId/capture` strhnete odpovídající částku z kauce
4. Doklady máte k dispozici pro policii/pojišťovnu, pokud by to bylo potřeba

---

## 6. Spolehlivost a odolnost proti výpadkům

Systém je navržený tak, aby výpadek jedné externí služby nezastavil celý proces:

- **Výpadek FleetBold při vytváření přístupu** → rezervace zůstane `PAID` (peníze má), chyba se zaloguje, lze kdykoliv zopakovat přes retry endpoint - zákazník nepřijde o peníze ani vy o kontrolu
- **Výpadek platební brány** → zákazník to uvidí hned při platbě, nic se nestane bez jeho vědomí (žádné tiché strhávání)
- **Výpadek serveru samotného** → doporučuji nastavit jednoduchý uptime monitoring (např. UptimeRobot - zdarma), který vás upozorní SMS/e-mailem, pokud `/health` endpoint přestane odpovídat

---

## 7. Co dělá systém intuitivním a rychlým pro zákazníka (shrnutí rozhodnutí)

- **3 kroky, ne 10** - údaje+doklady → platba → odemknutí
- **Velké písmo, velká tlačítka** - funguje i pro méně technicky zdatné/starší zákazníky
- **Žádná instalace Tesla účtu ani appky navíc** - jen webová stránka v telefonu
- **Výběr platby jedním klikem** - systém sám nabídne, co je aktuálně dostupné (karta, Google Pay, konkrétní banka)
- **Nic se neděje "naslepo"** - appka sama hlídá stav a ukáže tlačítko "Odemknout" v momentě, kdy je vše připravené

---

## 8. Doporučené pořadí dalších kroků (akční plán)

1. **Tento týden:** registrace u Comgate (sandbox) a kontakt na FleetBold
2. **Souběžně:** doplnit krok "výběr termínu/vozu" a ACTIVE→RETURNED→SETTLED tok
3. **Až budou API klíče:** nasazení na Railway, propojení domény
4. **Před prvním zákazníkem:** ověřit pojištění, nechat zkontrolovat podmínky právníkem
5. **Spuštění:** s manuální kontrolou první rezervace, postupná automatizace podle zkušeností

---

## 9. Ceny externích služeb a alternativy

### 9.1 Platební brána: Comgate

**Cena (tarif Easy — pro rozjezd):**
- 0,9 % + 1 Kč z každé platby kartou / Google Pay / Apple Pay
- Bankovní převody stejně: 0,9 % + 1 Kč
- Měsíční poplatek: 100 Kč (zdarma při měsíčním objemu plateb nad 100 000 Kč)
- Refundace 2 Kč, chargeback 990 Kč

Při vyšším objemu tarif Profi (0,62 % + 0,7 Kč u spotřebitelských karet EU) — vyžaduje splnění podmínek objemu.

**Proč Comgate, ne konkurence:**
- **GoPay** — podobná cenová hladina, veřejný ceník méně přehledný, o něco slabší nabídka bankovních tlačítek
- **ThePay** — menší nabídka platebních metod
- **Stripe** — silný na kartu/wallety, ale **nemá bankovní tlačítka** pro české banky (přímé přihlášení do IB) — to byl konkrétní požadavek

Comgate vyhrává hlavně kvůli 50+ metodám v jedné integraci a jasnému `methods` endpointu, ne proto, že by byl nejlevnější (cenově je ± srovnatelný s GoPay/ThePay).

### 9.2 Přístup k vozu: FleetBold

**Cena:** balíčky podle počtu vozidel („spotů“) — od cca 9,99 USD/měsíc (~220 Kč) do 19,99 USD/měsíc (~450 Kč) za auto. Enterprise na dotaz. Pro 1 auto řádově pár set Kč/měsíc.

**Alternativy:**

| Služba | Co nabízí | Poznámka |
|--------|-----------|----------|
| Levy Fleets | bílá appka + Fleet API, phone-key | spíš pro větší flotily, cena neveřejná |
| Tessie / Teslemetry | telemetrie, správa vozu | méně specializované na krátkodobý pronájem |
| Vlastní middleware nad Tesla Fleet API | plná kontrola, žádný poplatek 3. straně | týdny vývoje + Tesla od 2025 účtuje API podle objemu |

FleetBold je navržen proto, že je stavěný na krátkodobý pronájem (guest key se vytvoří při rezervaci a sám vyprší) a nevyžaduje hardware navíc.

### 9.3 E-mail a SMS

- **SendGrid** — cca 2 000 e-mailů/měsíc zdarma, pak od ~20 USD/měsíc. Alternativa: Amazon SES (levnější, složitější setup).
- **Twilio** — SMS do ČR cca 1–2 Kč/kus, bez paušálu. Levnější tuzemské: SMSbrana.cz, O2 SMS Gateway.

### 9.4 Odhad měsíčních nákladů (1 vůz, menší objem)

| Služba | Odhad / měsíc |
|--------|----------------|
| Comgate | 100 Kč (nebo 0 Kč nad 100k Kč obratu) + % z transakcí |
| FleetBold | ~220–450 Kč |
| SendGrid | 0 Kč (do 2000 e-mailů) |
| Twilio SMS | podle objemu, řádově desítky Kč |
| Hosting (Railway) | řádově stovky Kč |

**Reálně:** pár stovek Kč měsíčně fixně + procenta z plateb (ta jsou v ceně pro zákazníka, ne „navíc“ pro vás).

---

## 10. Shrnutí

Hardwarová investice je prakticky nulová. Celý systém stojí na softwaru (už postaveném) a registraci u Comgate, FleetBold a volitelně SendGrid/Twilio. Než pustíte prvního zákazníka, doplňte výběr termínu, tok vrácení (ACTIVE→RETURNED→SETTLED), ověřte pojištění a obchodní podmínky.
