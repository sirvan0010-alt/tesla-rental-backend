# Jak pracovat s vygenerovanými soubory (podrobný návod)

Tohle je odpověď na otázku "co s tím teď mám dělat" - krok za krokem, od
staženého ZIPu po běžící backend na vlastním serveru.

## 1. Co jste vlastně dostali

Není to hotová aplikace, kterou spustíte a je hotovo - je to **kostra
backendu** (server, který běží na pozadí a se kterým bude komunikovat vaše
appka/web). Obsahuje:

- zdrojový kód v TypeScriptu (`.ts` soubory) - text, který se před spuštěním
  musí "přeložit" do JavaScriptu (o tom níže)
- `package.json` - seznam knihoven, které kód potřebuje (Express, Prisma,
  Comgate klient...) a příkazy pro spuštění
- `prisma/schema.prisma` - popis databázové tabulky
- `.env.example` - vzor konfiguračního souboru s hesly/klíči

Nic z toho zatím nikam neposílá skutečné peníze ani nevytváří skutečný
přístup k autu - na to potřebujete doplnit vlastní přístupové údaje (viz
krok 4).

## 2. Kam soubory umístit

1. Stáhněte si všechny soubory ze zprávy (zachovejte adresářovou strukturu:
   `src/`, `src/routes/`, `src/services/`, `prisma/` musí zůstat jako
   podsložky, ne všechno v jedné složce).
2. Vytvořte si na svém počítači (nebo na serveru) prázdnou složku, např.
   `tesla-rental-backend`, a soubory do ní nakopírujte se zachováním
   struktury.
3. Založte si k tomu **Git repozitář** (i jen lokálně):
   ```
   cd tesla-rental-backend
   git init
   git add .
   git commit -m "Initial payment + reservation backend"
   ```
   Tím máte historii změn a můžete si to i nahrát na GitHub/GitLab jako
   soukromý repozitář (doporučuji - usnadní to nasazení i případnou další
   spolupráci s AI asistentem, který uvidí celý projekt najednou).

## 3. Co potřebujete nainstalované na počítači

- **Node.js** verze 18 nebo novější (obsahuje i `npm`, kterým se instalují
  knihovny) - stáhnete z nodejs.org, instalace je klikací průvodce jako
u běžného programu.
- **PostgreSQL databázi.** Pro vývoj/testování nejjednodušší cesta:
  nainstalovat Docker Desktop a spustit
  ```
  docker run --name tesla-rental-db -e POSTGRES_PASSWORD=heslo -e POSTGRES_DB=tesla_rental -p 5432:5432 -d postgres:16
  ```
  Tím vám na pozadí běží databáze bez ruční instalace PostgreSQL.

## 4. První spuštění (lokálně, na vašem počítači)

1. V terminálu přejděte do složky projektu: `cd tesla-rental-backend`
2. `npm install` - stáhne všechny knihovny z `package.json` do složky
   `node_modules` (tu si Git nemusí hlídat, je velká a generovaná - přidejte
   ji do `.gitignore`).
3. `cp .env.example .env` (na Windows: ručně zkopírujte soubor a přejmenujte
   na `.env`) a doplňte:
   - `DATABASE_URL` - pokud jste použili Docker příkaz výše, bude to
     `postgresql://postgres:heslo@localhost:5432/tesla_rental`
   - `COMGATE_MERCHANT_ID` / `COMGATE_SECRET` - dostanete po registraci na
     comgate.cz (mají sandbox/testovací režim zdarma, `COMGATE_TEST=true`)
   - `VEHICLE_ACCESS_API_URL` / `VEHICLE_ACCESS_API_KEY` - dostanete po
     registraci u FleetBold (nebo jiné zvolené platformy) jako partner
4. `npm run prisma:migrate` - vytvoří v databázi skutečnou tabulku podle
   `schema.prisma`. Poprvé se zeptá na název migrace, napište např. `init`.
5. `npm run dev` - spustí server na `http://localhost:3000`. V terminálu
   uvidíte `Tesla rental payment backend listening on :3000`.
6. Ověření, že žije: otevřete v prohlížeči `http://localhost:3000/health`,
   mělo by se zobrazit `{"ok":true}`.

Od teď máte běžící backend, na který se dá zkoušet posílat požadavky
(např. z appky, z Postmanu, nebo curl příkazem v terminálu).

## 5. Jak si to reálně vyzkoušet bez appky (Postman/curl)

Než bude hotový frontend, můžete backend testovat ručně:

```
curl -X POST http://localhost:3000/api/payment/reservations \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Jan Novák","customerEmail":"jan@example.com","customerPhone":"+420600123456","vehicleVin":"5YJ3E1EA...","startsAt":"2026-10-01T10:00:00Z","endsAt":"2026-10-03T10:00:00Z","depositAmountCzk":3000,"kauceAmountCzk":20000}'
```

Vrátí JSON s `id` rezervace - tím id pak voláte `/deposit` a `/kauce`.
Doporučuji nainstalovat **Postman** (zdarma, grafické rozhraní) - je
mnohem pohodlnější než psát curl příkazy ručně.

## 6. Jak dál pracovat na kódu (i s pomocí AI)

- Když budete chtít přidat další funkci (např. endpointy pro vrácení
  vozu), nejjednodušší je vzít **celý obsah složky projektu** (nebo odkaz
  na Git repozitář) a dát mi ho v novém zadání se slovy "pokračuj v tomto
  projektu, přidej...". Já pak upravím existující soubory místo psaní
  všeho od nuly.
- Menší úpravy (např. změna textu e-mailu, změna výše kauce) zvládnete
  i sami - hledejte podle komentářů v kódu (jsou psané česky schválně
  proto, aby se v tom šlo zorientovat i bez hluboké znalosti TypeScriptu).
- `npm run build` + `npm start` je "produkční" spuštění (rychlejší, bez
  automatického restartu při každé změně) - používá se až na ostrém
  serveru, ne při vývoji.

## 7. Nasazení na skutečný veřejný server

Až budete chtít, aby na backend mohl volat i Comgate webhook (musí být na
veřejné HTTPS adrese, ne na `localhost`), budete potřebovat hosting.
Nejjednodušší varianty pro tenhle typ projektu (Node.js + PostgreSQL):

- **Railway.app** nebo **Render.com** - obojí umí nasadit přímo z Git
  repozitáře na pár kliknutí a rovnou nabízí i spravovanou PostgreSQL
  databázi. Vhodné pro rozjezd bez vlastní serverové administrace.
- Vlastní VPS (např. na Hetzner/DigitalOcean) - víc práce (nastavení
  HTTPS certifikátu, firewallu), ale levnější v provozu a máte plnou
  kontrolu - vzhledem k vašemu zázemí (homelab, Proxmox) by vám tahle
  cesta nemusela dělat potíže.

Po nasazení nezapomeňte:
1. Aktualizovat `BACKEND_CALLBACK_URL` v `.env` na skutečnou veřejnou adresu
2. V Comgate administraci nastavit notifikační URL na
   `https://vase-domena.cz/api/payment/webhook`

## Shrnuití - co udělat HNED

1. Nainstalovat Node.js + Docker (pro lokální databázi)
2. Zkopírovat soubory do složky, `git init`
3. `npm install` → `.env` vyplnit (aspoň Comgate sandbox) → `npm run prisma:migrate` → `npm run dev`
4. Vyzkoušet přes Postman vytvoření rezervace a platby v sandboxu
5. Až bude tohle fungovat, vrátit se ke mně na navazující kroky (frontend,
   ACTIVE→RETURNED→SETTLED, notifikace)
