# Tesla rental — payment backend (kostra)

Řeší krok "platba zálohy + kauce" z celkového plánu, s tím, že zákazník
si sám vybere způsob platby (karta, Google Pay, konkrétní česká banka).

## Proč Comgate

Z porovnání platebních bran (Comgate/GoPay/ThePay/Stripe) vyšel Comgate
jako jediný, který v jedné integraci pokrývá vše potřebné:

- karty, Google Pay i Apple Pay
- "bankovní tlačítka" pro většinu českých bank (přímé přihlášení do
  internetového bankovnictví - ČSOB, KB, Fio, Raiffeisenbank, Moneta,
  Air Bank...) - přes 50 metod celkem
- endpoint `methods`, který vrátí AKTUÁLNÍ seznam dostupných metod/bank
  - takže frontend nemá natvrdo zadrátovaný seznam bank, jen ho vykreslí
    podle odpovědi API
- podporu pre-authorization (blokace kauce bez strhnutí) přes
  `capturePreauth` / `cancelPreauth`

V PHP světě existuje i hotový balíček `ages/payment-gateway`, který
sjednocuje Comgate a GoPay pod jedno rozhraní - pro Node/TS jsme
vycházeli z `comgate-node` (viz package.json).

**Poznámka k pre-auth a bankovním tlačítkům:** bankovní převody
(bankovní tlačítka) fungují jen jako běžná platba, ne jako blokace.
Pre-auth (skutečná "kauce, co se jen zablokuje") funguje pouze u karet
a walletů (Google Pay/Apple Pay běží nad kartou). Proto je v kódu záloha
(`createDepositPayment`) otevřená všem metodám (`method: "ALL"`), ale
kauce (`createDepositHold`) omezená na `CARD_ALL`. Zákazníkovi je potřeba
v UI vysvětlit, že kauci lze složit jen kartou/walletem - běžná praxe
u půjčoven.

## Struktura

```
prisma/schema.prisma          - model Reservation + stavový enum
public/index.html              - minimální frontend pro zákazníka (viz níže)
public/admin.html              - admin prohlížení dokladů
src/
  db.ts                       - Prisma client
  paymentService.ts           - veškerá komunikace s Comgate (metody, záloha, kauce)
  services/reservationService.ts   - přechody stavů rezervace
  services/vehicleAccessService.ts - vytvoření/zrušení dočasného přístupu k vozu (FleetBold apod.)
  services/notificationService.ts  - odeslání instrukcí zákazníkovi (e-mail/SMS - zatím stub)
  routes/payment.ts           - REST endpointy pro frontend appku
  server.ts                   - Express server (servíruje i public/)
```

## Frontend pro zákazníka (`public/index.html`)

Jedna statická stránka bez frameworku (čistý HTML/JS), servírovaná
přímo Express serverem na `http://localhost:3000/`. Tři kroky:

1. **Údaje** - jméno, e-mail, telefon + povinná fotka řidičáku (občanka volitelně)
   → založí rezervaci a nahraje doklady
2. **Platba** - tlačítka se seznamem metod natažená live z `/api/payment/methods`
3. **Čekání → Odemknout** - polling na `PAID`, pak tlačítko "Odemknout vůz"

## Doklady zákazníka (řidičák/občanka)

Ukládají se jako **běžné soubory, bez šifrování** - záměrně, na výslovné
přání, aby k nim majitel měl přímý přístup bez správy šifrovacích klíčů.

- Soubory leží na disku ve `uploads/documents/` (v `.gitignore`, není veřejný static)
- Přístup jen přes admin middleware (`ADMIN_API_KEY`)
- Na produkci doporučen šifrovaný disk (LUKS/BitLocker/cloud disk encryption)

**Endpointy (vyžadují backend implementaci – viz poznámka níže):**

| Metoda | Cesta | Účel |
|---|---|---|
| POST | /api/documents/:id/upload | zákazník nahraje foto ŘP (povinné) + OP (volitelné) |
| GET | /api/documents/:id/view | admin JSON s odkazy na doklady (x-admin-key) |
| GET | /uploads/documents/... | soubory fotek (chráněno admin klíčem) |

**`public/admin.html`** – ID rezervace + admin klíč → jméno, kontakt, fotky.

## Model rezervace a stavy

```
DRAFT -> PENDING_PAYMENT -> PAID -> ACTIVE -> RETURNED -> SETTLED
                 \-> FAILED          (nebo CANCELLED z DRAFT)
```

## Endpointy (platby)

| Metoda | Cesta | Účel |
|---|---|---|
| POST | /api/payment/reservations | založení rezervace (DRAFT) |
| GET | /api/payment/reservations/:id | stav rezervace |
| POST | /api/payment/reservations/:id/activate | PAID → ACTIVE |
| POST | /api/payment/reservations/:id/retry-access | retry přístupu k vozu |
| GET | /api/payment/methods | platební metody |
| POST | /api/payment/deposit | záloha |
| POST | /api/payment/kauce | pre-auth kauce |
| POST | /api/payment/kauce/:transId/release | uvolnění kauce |
| POST | /api/payment/kauce/:transId/capture | strhnutí kauce |
| POST | /api/payment/webhook | Comgate notifikace |
| GET | /api/payment/:transId/status | stav platby |

## Nastavení

1. `cp .env.example .env` – doplnit Comgate, DATABASE_URL, VEHICLE_ACCESS_*, **ADMIN_API_KEY**
2. `npm install`
3. `npm run prisma:migrate`
4. Comgate notifikační URL → `/api/payment/webhook`
5. `npm run dev`

## Co doplnit dál (backend pro doklady)

Frontend a schema už doklady očekávají. **Ještě chybí v repozitáři:**

- `src/routes/documents.ts` – upload + view endpointy
- `src/middleware/adminAuth.ts` – kontrola `x-admin-key` / `?key=`
- úprava `src/server.ts` – napojení routes + chráněný přístup k `/uploads`
- `multer` (nebo ekvivalent) v `package.json` pro multipart upload
- `ADMIN_API_KEY` v `.env.example`

Bez těchto souborů frontend při nahrání dokladu selže. Pošlete je, nebo je můžu doplnit.

## Co dál (produkt)

- výběr termínu/vozu
- ACTIVE → RETURNED → SETTLED + fotky při vrácení
- reálné notifikace (e-mail/SMS)
- napojení Tesla/FleetBold podle partnerské dokumentace
