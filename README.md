# Tesla rental — contactless backend

Backend + minimální frontend pro bezkontaktní pronájem **Tesla Model Y Performance** (Comgate platby, rezervace, doklady, přístup k vozu, vrácení, vyrovnání kauce).

## Stav projektu (aktuální)

Hotové v kódu (end-to-end tok v `MOCK_MODE`):

- výběr vozu + termínu + kontrola dostupnosti (`Vehicle`, `src/routes/vehicles.ts`, seed)
- nahrání dokladů (řidičák povinně, občanka volitelně) + admin prohlížení
- platba zálohy + pre-auth kauce (Comgate nebo mock)
- webhook → PAID → dočasný přístup k vozu (FleetBold šablona / mock)
- odemčení (ACTIVE) → vrácení s fotkami (RETURNED) → settle kauce (SETTLED)
- security: `getReservationPublic` (bez leaku unlock URL / PII), `requireAdminKey` na settle/kauce, timing-safe compare, startup guard proti výchozímu `ADMIN_API_KEY`

Ještě není ostré (čeká na vás):

- registrace Comgate + FleetBold + veřejná HTTPS (Railway)
- reálné e-mail/SMS (SendGrid/Twilio — zatím `console.log`)

## Proč Comgate

- karty, Google Pay, Apple Pay
- bankovní tlačítka (ČSOB, KB, Fio, …)
- endpoint `methods` — frontend si natahá aktuální seznam
- pre-auth kauce (`capturePreauth` / `cancelPreauth`) — jen karty/wallety, ne bankovní tlačítka

## Struktura

```
prisma/
  schema.prisma          Reservation + Vehicle + stavy
  seed.ts                Tesla Y Performance (Prostějov)
public/
  index.html             zákaznický tok (4 kroky)
  admin.html             doklady + settle kauce
src/
  db.ts
  paymentService.ts      Comgate + MOCK_MODE
  middleware/adminAuth.ts
  routes/
    payment.ts
    documents.ts
    vehicles.ts
  services/
    reservationService.ts   stavy + getReservationPublic
    vehicleAccessService.ts FleetBold šablona + MOCK
    notificationService.ts  stub e-mail/SMS
  server.ts              Express + startup guard ADMIN_API_KEY
docker-compose.yml       Postgres
.env.example             MOCK_MODE=true výchozí
```

## Stavy rezervace

```
DRAFT → PENDING_PAYMENT → PAID → ACTIVE → RETURNED → SETTLED
                 ↘ FAILED / CANCELLED
```

## Endpointy

### Zákazník

| Metoda | Cesta | Účel |
|--------|--------|------|
| GET | /api/vehicles | seznam aktivních vozů |
| GET | /api/vehicles/:id/availability | dostupnost termínu |
| POST | /api/payment/reservations | založení rezervace |
| GET | /api/payment/reservations/:id | veřejný stav (`getReservationPublic`) |
| POST | /api/documents/:id/upload | nahrání ŘP (+ OP) |
| POST | /api/documents/:id/return-photos | fotky při vrácení |
| GET | /api/payment/methods | platební metody |
| POST | /api/payment/deposit | záloha |
| POST | /api/payment/kauce | pre-auth kauce |
| POST | /api/payment/webhook | Comgate notifikace |
| POST | /api/payment/reservations/:id/activate | PAID → ACTIVE |

### Admin (`x-admin-key`)

| Metoda | Cesta | Účel |
|--------|--------|------|
| GET | /api/documents/:id/view | JSON + odkazy na doklady |
| GET | /uploads/documents/… | soubory dokladů |
| GET | /uploads/returns/… | fotky vrácení |
| POST | /api/payment/reservations/:id/settle | uvolnit / strhnout kauci |
| POST | /api/payment/kauce/:transId/release | uvolnění kauce |
| POST | /api/payment/kauce/:transId/capture | strhnutí kauce |

## Lokální spuštění (MOCK, bez registrací)

```bash
git clone https://github.com/sirvan0010-alt/tesla-rental-backend.git
cd tesla-rental-backend
cp .env.example .env          # MOCK_MODE=true
docker compose up -d          # Postgres
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
# http://localhost:3000
# http://localhost:3000/admin.html  (klíč z .env)
```

## Security (stručně)

- `GET /reservations/:id` nevrací unlock URL, kontakty ani transId — jen `vehicleAccessReady`
- unlock URL jde zákazníkovi přes `/activate` (a e-mail/SMS až budou zapojené)
- admin + settle + release/capture kauce vyžadují `ADMIN_API_KEY`
- mimo `MOCK_MODE` server s výchozím admin klíčem **nespustí**
- porovnání klíče: `crypto.timingSafeEqual`

## Co dál

1. Otestovat celý tok v MOCK_MODE
2. Comgate sandbox + `MOCK_MODE=false`
3. FleetBold / Tesla přístup — upravit jen `vehicleAccessService.ts`
4. Nasazení (Railway) + silný `ADMIN_API_KEY` + HTTPS webhook
5. SendGrid / Twilio v `notificationService.ts`

Detailní plán: `docs/kompletni-plan-tesla-pronajem.md`  
Praktický návod: `HOW_TO_WORK_WITH_THIS.md`
