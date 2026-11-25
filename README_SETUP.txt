NEETAA'S TREATS — WEBSITE + ORDERS + DASHBOARD  (hosted on Vercel)

HOW IT WORKS
- Customers pick items, tap "Place your order", and the order is saved to your dashboard.
- Your phone gets an instant push alert via the free ntfy app with full order details + a 1-tap
  "Chat on WhatsApp" button to message the customer right back!
- "Chat with us on WhatsApp" buttons on the site open a normal WhatsApp chat for questions and custom quotes.

INSTANT PHONE ALERTS WITH NTFY (1-minute setup, 100% free)
1. Install the free "ntfy" app on your phone (Android Play Store or iPhone App Store).
2. Open ntfy, tap "+", and subscribe to a private, hard-to-guess topic name
   (for example:  neetaa-treats-orders-7492k  — treat it like a password so only you subscribe).
   Allow notifications when your phone asks.
3. In Vercel -> Project -> Settings -> Environment Variables:
   - Add:     NTFY_TOPIC = the exact topic name you just created
   - Remove:  TEXTMEBOT_APIKEY (if you added it earlier, so it doesn't clutter alert status)
4. Go to Vercel -> Deployments -> ... -> Redeploy.
5. Open YOUR-SITE/admin.html -> Settings -> click "Send a test phone alert" — your phone will chime right away!
