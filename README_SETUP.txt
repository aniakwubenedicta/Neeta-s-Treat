NEETAA'S TREATS — WEBSITE + ORDERS + DASHBOARD  (hosted on Vercel)

HOW IT WORKS
- Customers pick items, tap "Place your order", and the order is saved to your dashboard.
- You get an instant Telegram message on your phone with the full order details + a 1-tap WhatsApp link to message the customer back!
- "Chat with us on WhatsApp" buttons open a normal WhatsApp chat for questions and custom cake quotes.
- Dashboard: /admin.html (Overview, Orders, Products & prices, Reviews, Supplies & costs, Settings).
  Prices, photos, stock status and reviews you change there appear on the website for everyone.

GO LIVE ON VERCEL (one-time, ~5 minutes)
1. Push any updates to GitHub (in GitHub Desktop, click "Push origin"). Vercel auto-deploys.
2. Database: in your Vercel project open the Storage tab -> Create -> "Upstash for Redis" (free plan)
   -> connect it to the project. This adds KV_REST_API_URL and KV_REST_API_TOKEN automatically.
3. Admin login: Project -> Settings -> Environment Variables, add:
      ADMIN_EMAIL     = the email you will sign in with
      ADMIN_PASSWORD  = a long, strong password
4. Instant Order Alerts on your phone (Telegram Bot — 100% free, takes 2 minutes):
   a. Open Telegram on your phone and search for  @BotFather  (verified blue check).
   b. Tap Start, send  /newbot , pick a name (e.g. Neetaa Orders) and a username ending in "bot"
      (e.g. neetaa_orders_bot).
   c. BotFather replies with your HTTP API token (looks like 123456789:AAH...).
      Save that as  TELEGRAM_BOT_TOKEN  in Vercel.
   d. IMPORTANT: open your new bot (tap the t.me/... link BotFather gave you) and tap Start!
   e. In Telegram, search for  @userinfobot , tap Start, and copy your numeric "Id" (e.g. 987654321).
      Save that as  TELEGRAM_CHAT_ID  in Vercel.
5. (Optional) Email backup alerts: sign up free at resend.com, create an API key, and add
   RESEND_API_KEY and NOTIFY_EMAIL in Vercel to also receive every order by email.
6. Redeploy in Vercel (Deployments -> ... -> Redeploy) so the new Environment Variables take effect.
7. IMPORTANT first login: open YOUR-SITE/admin.html and sign in once. This publishes your menu to the live
   site. Until you do, online ordering stays closed.
8. In Dashboard -> Settings, press "Send a test order alert" and check Telegram! Then place a test order
   on your website to see the full order message + 1-tap WhatsApp customer link.

NOTES
- To change the admin password, edit ADMIN_PASSWORD in Vercel and redeploy.
- Never put secrets in GitHub. They live only in Vercel's Environment Variables.
- Local preview (on your computer without Vercel) stores data in that browser only,
  with login admin@neetaastreats.com / Neetaa2026! (does not exist on the live site).
