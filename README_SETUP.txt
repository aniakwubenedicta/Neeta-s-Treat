NEETAA'S TREATS — WEBSITE + ORDERS + DASHBOARD  (hosted on Vercel)

HOW IT WORKS
- Customers pick items, tap "Place your order", and the order is saved to your dashboard.
- You get a WhatsApp message with the full order details automatically.
- "Chat with us on WhatsApp" buttons open a normal WhatsApp chat for questions and custom cake quotes.
- Dashboard: /admin.html (Overview, Orders, Products & prices, Reviews, Supplies & costs, Settings).
  Prices, photos, stock status and reviews you change there appear on the website for everyone.

FILES
- index.html, admin.html, store.js, config.js, logo.png   the website and dashboard
- api/                                                    small server functions (orders, login, catalogue, pictures, WhatsApp alert)
- vercel.json, package.json                               Vercel settings
- .env.example                                            the settings you must add in Vercel (no real secrets in GitHub)

GO LIVE (one-time, about 10 minutes)
1. GitHub: put all files from this folder in https://github.com/aniakwubenedicta/Neeta-s-Treat
   (upload the files, or use GitHub Desktop / git). Don't upload files listed in .gitignore.
2. Vercel: "Add New > Project", import that GitHub repo, click Deploy.
3. Database: in the Vercel project open the Storage tab > Create > "Upstash for Redis" (free plan) > connect it
   to the project. This adds KV_REST_API_URL and KV_REST_API_TOKEN automatically.
4. Admin login: Project > Settings > Environment Variables, add
      ADMIN_EMAIL     = the email you will sign in with
      ADMIN_PASSWORD  = a long, strong password
5. WhatsApp alerts (free, CallMeBot):
   a. On your phone, save the number +34 644 51 95 23 as a contact ("CallMeBot").
   b. Send it this WhatsApp message:   I allow callmebot to send me messages
   c. It replies with your API key. In Vercel add
      NOTIFY_WHATSAPP  = your number with country code, digits only (e.g. 2349066434486)
      CALLMEBOT_APIKEY = the key it sent you
      (If the number or message above has changed, follow the steps on https://www.callmebot.com/blog/free-api-whatsapp-messages/)
6. Redeploy (Deployments > ... > Redeploy) so the new settings apply.
7. IMPORTANT first login: open YOUR-SITE/admin.html and sign in once. This publishes your menu to the live
   site. Until you do, online ordering stays closed.
8. In Dashboard > Settings press "Send a test WhatsApp alert". Then place a test order on the website and
   check it appears in Orders and on your WhatsApp.

NOTES
- To change the admin password, edit ADMIN_PASSWORD in Vercel and redeploy.
- CallMeBot is free but unofficial; if it ever stops, tell your developer to swap in the WhatsApp Business API
  or Twilio inside api/_lib.js (sendWhatsApp).
- Never put secrets in GitHub. They live only in Vercel's Environment Variables.
- Photos are stored in the Upstash database (resized automatically). The free plan is plenty for a menu.
- Local preview (opening the site on your own computer without Vercel) stores everything in that browser only,
  with the login  admin@neetaastreats.com / Neetaa2026!  — this is for testing only and does not exist on the live site.
