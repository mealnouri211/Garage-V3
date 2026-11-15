# HeroWorks V3

Static website (HTML/CSS/JS, no build). Open `index.html`, or upload the whole folder to GitHub Pages.
V3 stores its data under `hw3_*` keys, so it does not mix with V1/V2 on the same address.

## What's new in V3
- **Owner back office** (`admin.html`, not linked anywhere on the site)
  - How to get in: use the normal **Sign in** page (login.html). Type the owner username in the first box and the owner password in the second. A customer types a phone number and lands in their account; the owner types the username and lands on the back office. A wrong owner password shows the same "wrong phone number or password" message as for customers.
  - Opening `admin.html` directly without being signed in as owner sends you to the sign-in page. The page has no footer, WhatsApp button or assistant.
  - The workshop board has an "Owner back office" button (only when you are signed in as owner).
  - Login: `owner` / `owner1234` (demo). Change it in Settings -> Security (the username must contain a letter).
  - Overview: orders, booked value, collected, still to collect, new requests, "needs attention" list, today's cars, 14-day chart, top services, value by payment method.
  - Orders: search, filters (status / paid / dates), CSV export, detail drawer (customer + WhatsApp/call, change status, mark paid, payment-link message for Deema/Taly, internal note, print job sheet, cancel).
  - Schedule (next 14 days): **add** an appointment (phone/walk-in customer, car, services with editable prices, day and time), **edit** any appointment (customer, car, services, prices, day, time, payment, notes), **move** it, **cancel** it or **delete** it. Every row in the calendar has Edit and Delete buttons.
  - **Pending requests**: when a customer books online it arrives as a *pending request* (it holds its time slot) in Schedule -> Pending requests. Approve it (optionally changing the day/time first) or decline it. The customer sees "Awaiting confirmation" until you answer. Turn this off in Settings -> Pending requests to confirm customer bookings automatically.
  - Customers (spend, history, cars, CSV, add an appointment for them), Inquiries (from the chat assistant), Services & prices, Settings.
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

## Search engines (SEO)
Sites are not ranked lower because they were built with Claude. Ranking comes from the usual things, and the technical part is already done here:
- A proper title and description for every public page (Arabic and English), canonical links, Open Graph preview image, business data (JSON-LD) on the home page and a service/product record on each product page.
- `sitemap.xml` (56 pages) and `robots.txt`. Private pages (login, account, job tracker, cart, checkout, workshop board) are marked `noindex`.
- The web address used in these files is **https://heroworkskw.com**. If you publish on a different address, replace it in `sitemap.xml`, `robots.txt`, the `<link rel="canonical">` / `og:url` lines in each page, and in `js/common.js` (`HW.setSeo`) and `js/product.js`.
After you publish: add the site to Google Search Console and submit `sitemap.xml`, and keep your Google Business Profile (Google Maps listing) up to date. That listing matters most for a local garage.
