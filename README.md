# ticket-pulse-demo

Proyek demonstrasi perkuliahan untuk sistem reservasi tiket event (**Ticket Pulse**) berbasis monorepo Node.js (ESM), dirancang untuk mendemonstrasikan praktik **Continuous Integration (CI)** modern menggunakan **GitHub Actions**, **Service Containers (PostgreSQL & Redis)**, **Vitest V8 Coverage Quality Gate**, dan **Docker Multi-Stage Build**.

## Arsitektur Monorepo ujicoba

```text
ticket-pulse-demo/
├── .github/workflows/ci.yml   # Pipeline CI deklaratif (backend-ci, frontend-ci, docker-verify)
├── backend/                   # REST API Express, PostgreSQL, Redis, & Vitest Quality Gate
│   ├── src/
│   │   ├── config/env.js      # Konfigurasi environment variables
│   │   ├── db/migrate.js      # Skrip migrasi skema tabel reservations
│   │   ├── infra/db.js        # Connection pool PostgreSQL
│   │   ├── infra/redis.js     # Klien Redis & manajemen kuota event
│   │   ├── services/          # Logika bisnis reservasi & kalkulasi harga tiket
│   │   ├── app.js             # Definisi endpoint Express API
│   │   └── server.js          # Entrypoint HTTP server
│   ├── tests/                 # Unit test & integration test (Supertest + Vitest mocks)
│   └── Dockerfile             # Multi-stage build (node:20-alpine, non-root USER node)
├── frontend/                  # Dashboard UI ringan berbasis Vite + Vitest (jsdom)
│   ├── src/main.js            # Helper format harga IDR, estimasi total, & rendering DOM
│   ├── tests/ticket-ui.test.js
│   └── Dockerfile             # Multi-stage build (node:20-alpine -> nginx:alpine)
└── deployments/
    └── docker-compose.yml     # Orkestrasi PostgreSQL 16, Redis 7, Backend, & Frontend
```

## Prasyarat

- **Node.js** v20+ dan **npm** v10+
- **Docker** dan **Docker Compose** (untuk menjalankan PostgreSQL, Redis, atau build container penuh)

## Menjalankan Tes Lokal

### 1. Backend (Unit, Integration, & Coverage Quality Gate)

Seluruh test suite backend menggunakan `vi.mock` untuk layer `db.js` dan `redis.js` sehingga dapat dijalankan secara terisolasi tanpa koneksi database maupun Redis aktif.

```bash
cd backend
npm ci
npm test
npm run test:coverage
```

Konfigurasi Vitest (`backend/vitest.config.js`) menerapkan Quality Gate minimal:

- **Lines**: `70%`
- **Functions**: `70%`
- **Branches**: `65%`
- **Statements**: `70%`

Laporan cakupan kode dihasilkan pada direktori `backend/coverage/` (`text`, `html`, dan `lcov`).

### 2. Frontend (Unit Test & Production Build)

```bash
cd frontend
npm ci
npm test
npm run build
```

Hasil build statis akan tersimpan di `frontend/dist/`.

## Menjalankan Layanan & Migrasi Database Lokal

Anda dapat menjalankan seluruh stack menggunakan Docker Compose:

```bash
docker compose -f deployments/docker-compose.yml build
docker compose -f deployments/docker-compose.yml up -d postgres redis
```

Setelah PostgreSQL siap, jalankan migrasi tabel `reservations`:

```bash
cd backend
DB_HOST=localhost DB_PORT=5432 DB_USER=devops DB_PASSWORD=devops_secret DB_NAME=tickets_ci npm run db:migrate
```

Untuk menjalankan seluruh container (termasuk `backend` dan `frontend`):

```bash
docker compose -f deployments/docker-compose.yml up --build
```

- **Backend API**: `http://localhost:3000/healthz`
- **Frontend UI**: `http://localhost:8080`

## Skenario Demonstrasi Live (Quality Gate Failure)

1. Pada kondisi awal, `npm run test:coverage` di `backend/` memiliki cakupan global **87.37%** (`Lines` & `Statements`) dan lulus Quality Gate (`>= 70%`).
2. Untuk memicu kegagalan Quality Gate, buat berkas baru **`backend/src/services/promo.service.js`** (48 baris) **tanpa** menambahkan unit test:

```javascript
export const PROMO_CODES = {
  EARLYBIRD10: { discountRate: 0.1, minSeats: 1, active: true },
  CAMPUS20: { discountRate: 0.2, minSeats: 2, active: true },
  EXPIRED50: { discountRate: 0.5, minSeats: 1, active: false },
};

export function validatePromoCode(code, seatQty) {
  if (!code || typeof code !== "string") {
    throw new Error("Promo code must be a non-empty string");
  }
  const normalized = code.trim().toUpperCase();
  const promo = PROMO_CODES[normalized];
  if (!promo) {
    throw new Error("Promo code not found");
  }
  if (!promo.active) {
    throw new Error("Promo code is no longer active");
  }
  if (!Number.isInteger(seatQty) || seatQty < promo.minSeats) {
    throw new Error("Seat quantity does not meet promo requirement");
  }
  return { code: normalized, ...promo };
}

export function applyPromoDiscount(subtotal, code, seatQty) {
  if (typeof subtotal !== "number" || subtotal <= 0) {
    throw new Error("Subtotal must be a positive number");
  }
  const promo = validatePromoCode(code, seatQty);
  const discountAmount = Math.round(subtotal * promo.discountRate);
  const finalPrice = Math.max(0, subtotal - discountAmount);
  return {
    promoCode: promo.code,
    discountRate: promo.discountRate,
    discountAmount,
    finalPrice,
  };
}

export function listActivePromos() {
  return Object.entries(PROMO_CODES)
    .filter(([, details]) => details.active)
    .map(([code, details]) => ({
      code,
      discountPercent: Math.round(details.discountRate * 100),
      minSeats: details.minSeats,
    }));
}
```

3. Jalankan kembali `npm run test:coverage` di `backend/` atau push ke branch PR — Vitest V8 Coverage akan mencatat penurunan cakupan global menjadi **60.81%** (`Lines` & `Statements`) sehingga pipeline CI gagal otomatis pada tahap Quality Gate:

```text
ERROR: Coverage for lines (60.81%) does not meet global threshold (70%)
ERROR: Coverage for statements (60.81%) does not meet global threshold (70%)
```

4. Untuk mendemonstrasikan perbaikan pada PR yang sama, tambahkan unit test **`backend/tests/unit/promo.service.test.js`** lalu jalankan kembali `npm run test:coverage` agar pipeline kembali lulus Quality Gate:

```javascript
import { describe, it, expect } from "vitest";
import {
  validatePromoCode,
  applyPromoDiscount,
  listActivePromos,
} from "../../src/services/promo.service.js";

describe("promo.service unit tests", () => {
  it("validates active promo codes and rejects invalid/expired ones", () => {
    expect(validatePromoCode("campus20", 2)).toEqual({
      code: "CAMPUS20",
      discountRate: 0.2,
      minSeats: 2,
      active: true,
    });
    expect(() => validatePromoCode("", 1)).toThrow(
      "Promo code must be a non-empty string",
    );
    expect(() => validatePromoCode("UNKNOWN", 1)).toThrow(
      "Promo code not found",
    );
    expect(() => validatePromoCode("EXPIRED50", 2)).toThrow(
      "Promo code is no longer active",
    );
    expect(() => validatePromoCode("CAMPUS20", 1)).toThrow(
      "Seat quantity does not meet promo requirement",
    );
  });

  it("applies promo discount accurately", () => {
    const result = applyPromoDiscount(700000, "CAMPUS20", 2);
    expect(result).toEqual({
      promoCode: "CAMPUS20",
      discountRate: 0.2,
      discountAmount: 140000,
      finalPrice: 560000,
    });
    expect(() => applyPromoDiscount(0, "CAMPUS20", 2)).toThrow(
      "Subtotal must be a positive number",
    );
  });

  it("lists only active promos", () => {
    expect(listActivePromos()).toEqual([
      { code: "EARLYBIRD10", discountPercent: 10, minSeats: 1 },
      { code: "CAMPUS20", discountPercent: 20, minSeats: 2 },
    ]);
  });
});
```
