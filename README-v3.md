# HeroWorks V3

Static website (HTML/CSS/JS, no build). Open `index.html`, or upload the whole folder to GitHub Pages.
V3 stores its data under `hw3_*` keys, so it does not mix with V1/V2 on the same address.

## What's new in V3
- **Owner back office: `admin.html`** (link "Owner" in the footer)
  - Login: `owner` / `owner1234` (demo). Change it in Settings -> Security.
  - Overview: orders, booked value, collected, still to collect, new requests, "needs attention" list, today's cars, 14-day chart, top services, value by payment method.
  - Orders: search, filters (status / paid / dates), CSV export, detail drawer (customer + WhatsApp/call, change status, mark paid, payment-link message for Deema/Taly, internal note, print job sheet, cancel).
  - Schedule (next 14 days), Customers (spend, history, cars, CSV), Requests (assistant leads).
  - Services & prices: show/hide a service, change the base price, old price and duration.
  - Settings: opening hours, bays, booking window, closed days, About-us text (AR/EN), camera links, workshop PIN, owner password, full JSON export, demo reset.
  - Beep + alert when a new order arrives while the page is open.
- Logo in light mode now sits on the page background with black wording (`assets/logo-light.png`).
- Deema and Taly added next to K-Net and Apple Pay (checkout, footer, top banner, job page, search data).
- "Garage in your pocket" section removed. Empty "About us" section added (fill it in from the back office, or leave empty).

## Important: what is real and what is demo
All data (orders, customers, owner password) lives in the **browser's localStorage**. That means:
- The owner only sees orders made **in the same browser**. Orders placed on customers' own phones will NOT reach the owner's screen yet.
- The owner password is demo-level protection only (anyone with the browser's dev tools can read the data).
- Deema and Taly are options only: no payment is taken. The garage sends the payment link on WhatsApp and marks the order paid.

To go live, `js/store.js` (`HW.api`) must be replaced by a shared backend (Supabase/Firebase/own server). The rest of the site does not change.

## Demo accounts
Customer 9999 0001 / demo1234 · Workshop PIN 1234 · Owner owner / owner1234
