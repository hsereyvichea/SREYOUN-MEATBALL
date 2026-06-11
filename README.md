# SREYOUN MEATBALL POS

Custom point-of-sale and invoice app for SREYOUN MEATBALL.

## What It Does

- Create retail or wholesale orders with different prices.
- Add customer name, phone number, notes, and payment status.
- Track total, amount paid, and balance due.
- Save, share, and print invoices.
- Print on Sunmi devices.
- Sync invoices between devices over WiFi.
- Optionally sync menu/prices between devices.
- View daily, weekly, and custom sales reports.
- See total sales, paid/unpaid totals, balance due, items sold, average sale, and best sellers.

## Run Locally

```bash
npm install
npm run dev
```

## Build Web App

```bash
npm run build
```

## Build Android Debug APK

```bash
npm run android:sync
npm run android:debug
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Notes

This app is built with React, Vite, Capacitor, and Android native code for Sunmi printing and WiFi sync.
