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
src/
  db.ts                       - Prisma client
  paymentService.ts           - veškerá komunikace s Comgate (metody, záloha, kauce)
  services/reservationService.ts   - přechody stavů rezervace
  services/vehicleAccessService.ts - vytvoření/zrušení dočasného přístupu k vozu (FleetBold apod.)
  services/notificationService.ts  - odeslání instrukcí zákazníkovi (e-mail/SMS - zatím stub)
  routes/payment.ts           - REST endpointy pro frontend appku
  server.ts                   - Express server
```

## Model rezervace a stavy

`Reservation` drží zákazníka, termín, vůz, částky (záloha/kauce), a klíčové
`depositTransId` / `kauceTransId` z Comgate + `vehicleAccessId` (a případně
`vehicleAccessError`) pro napojení na přístup k vozu.

```
DRAFT -> PENDING_PAYMENT -> PAID -> ACTIVE -> RETURNED -> SETTLED
                 \-> FAILED          (nebo CANCELLED z DRAFT)
```

- **DRAFT**: založeno, čeká na platbu
- **PENDING_PAYMENT**: platba/kauce odeslána na Comgate, čeká se na webhook
- **PAID**: záloha i kauce potvrzeny -> webhook rovnou zkusí vytvořit přístup k vozu
- **ACTIVE**: zákazník skutečně odemkl/převzal vůz (appka zavolá endpoint převzetí)
- **RETURNED**: vůz vrácen, čeká se na kontrolu fotek/telemetrie
- **SETTLED**: kauce uvolněna/strhnuta, rezervace uzavřena

Webhook (`/api/payment/webhook`) si stav vždy ověří zpět přes
`getPaymentStatus(transId)` - nevěří jen obsahu notifikace (ochrana proti
podvržení). Na `PAID` přepne rezervaci teprve když jsou evidované OBĚ
transakce (záloha i kauce), viz `isFullyPaid()`, a rovnou zavolá
`ensureVehicleAccess()`.

### Co dělá `ensureVehicleAccess()` a proč je to bezpečné

1. Pokud rezervace už `vehicleAccessId` má, nic nedělá (idempotence -
   webhook od Comgate může dorazit i vícekrát).
2. Zavolá `vehicleAccessService.createVehicleAccess()` (FleetBold/Tesla).
3. Při úspěchu uloží `vehicleAccessId` a pošle e-mail/SMS.
4. **Při selhání** (výpadek FleetBold API apod.) se chyba uloží do
   `vehicleAccessError`, ale rezervace ZŮSTÁVÁ `PAID` - zákazník má
   zaplaceno, jen zatím nemá přístup. Nic se nevrací, nic se neruší.
   Přístup lze kdykoliv dodatečně vytvořit přes
   `POST /api/payment/reservations/:id/retry-access` (ručně, nebo
   later přes cron job, který projede rezervace s `vehicleAccessError != null`).

## Endpointy

| Metoda | Cesta | Účel |
|---|---|---|
| POST | /api/payment/reservations | založení rezervace (DRAFT) |
| GET | /api/payment/reservations/:id | stav rezervace pro frontend |
| POST | /api/payment/reservations/:id/retry-access | ruční/cron retry vytvoření přístupu k vozu |
| GET | /api/payment/methods | seznam aktuálně dostupných platebních metod/bank |
| POST | /api/payment/deposit | platba zálohy zvolenou metodou (uloží depositTransId) |
| POST | /api/payment/kauce | blokace kauce - pre-auth (uloží kauceTransId) |
| POST | /api/payment/kauce/:transId/release | uvolnění kauce po vrácení bez škody |
| POST | /api/payment/kauce/:transId/capture | strhnutí kauce (celé/části) při škodě |
| POST | /api/payment/webhook | notifikace od Comgate -> ověří stav -> posune rezervaci -> vytvoří přístup |
| GET | /api/payment/:transId/status | dotaz na stav platby (polling) |

## Nastavení

1. `cp .env.example .env` a doplnit merchant ID + secret z Comgate administrace,
   `DATABASE_URL` a `VEHICLE_ACCESS_API_URL`/`VEHICLE_ACCESS_API_KEY`
2. `npm install`
3. `npm run prisma:migrate` (vytvoří tabulku `Reservation` v PostgreSQL)
4. V Comgate administraci nastavit notifikační URL na `/api/payment/webhook`
5. `npm run dev`

## Co doplnit dál

- **`vehicleAccessService.ts`**: tvar requestu na `/v1/guest-keys` je návrh
  podle typického chování těchto služeb - jakmile se zaregistrujete u
  FleetBold (nebo zvolíte jinou platformu/Tessie/vlastní Fleet API
  middleware), upravte jen tenhle soubor podle jejich skutečné dokumentace.
  Zbytek appky se nemění.
- **`notificationService.ts`**: nahradit `console.log` skutečným
  voláním SendGrid/Mailgun (e-mail) a Twilio/O2 SMS Gateway (SMS)
- Endpointy pro přechod ACTIVE -> RETURNED -> SETTLED (upload fotek při
  vrácení, propojení s `releaseDepositHold`/`captureDepositHold`)
- Testovací (sandbox) platby přes `COMGATE_TEST=true`
