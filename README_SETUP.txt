NEETAA'S TREATS — WEBSITE + ORDERS + DASHBOARD  (hosted on Vercel)

HOW IT WORKS
- Customers pick items, tap "Place your order", and the order is saved to your dashboard.
- You get an automatic WhatsApp message with every order's details + a 1-tap link to chat the customer back.
- "Chat with us on WhatsApp" buttons open a normal WhatsApp chat for questions and custom cake quotes.
- Dashboard: /admin.html (Overview, Orders, Products & prices, Reviews, Supplies & costs, Settings).

GO LIVE ON VERCEL
1. Push updates in GitHub Desktop ("Push origin"). Vercel auto-deploys.
2. Storage tab -> Create -> "Upstash for Redis" (free plan) -> connect to your project.
3. Settings -> Environment Variables, add:
      ADMIN_EMAIL     = your login email
      ADMIN_PASSWORD  = your strong password
      NOTIFY_WHATSAPP = 2349066434486
4. Choose ONE WhatsApp alert provider and add its keys in Vercel:

   OPTION A (FASTEST FREE WHATSAPP — TextMeBot, ~2 minutes):
   a. Go to https://textmebot.com/ and request a free API key with your WhatsApp number.
   b. Follow the link they email you to connect WhatsApp, then add in Vercel:
      TEXTMEBOT_APIKEY = the key TextMeBot sent you

   OPTION B (OFFICIAL & MOST RELIABLE — Meta WhatsApp Business Cloud API, ~₦10/order):
   a. Go to https://developers.facebook.com/ -> My Apps -> Create App -> Business -> add "WhatsApp".
   b. Under WhatsApp -> API Setup, copy your Phone Number ID and generate a Permanent System User Token
      (Meta Business Settings -> Users -> System Users -> Generate Token with whatsapp_business_messaging).
   c. Under WhatsApp Manager -> Message Templates, create a Utility template named:  new_order_alert
      with this exact Body:
        New Order #{{1}} from {{2}} ({{3}}).
        Items: {{4}}.
        Total: {{5}}.
        Delivery/Notes: {{6}}.
   d. In Vercel add:
      WHATSAPP_ACCESS_TOKEN    = your permanent token
      WHATSAPP_PHONE_NUMBER_ID = your Phone Number ID
      WHATSAPP_TEMPLATE_NAME   = new_order_alert
      WHATSAPP_TEMPLATE_LANG   = en_US

5. Redeploy in Vercel (Deployments -> ... -> Redeploy).
6. Sign in once at YOUR-SITE/admin.html to publish your menu live, then go to Settings ->
   "Send a test WhatsApp alert".
