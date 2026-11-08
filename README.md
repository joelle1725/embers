# Embers

A disposable camera for your party, in the browser. Guests tap a shared link, join with a name and email, confirm a 6 digit code, and get 10 shots with a film look the host picked. Photos stay hidden until the host develops the film, then everyone opens one shared gallery with the party code and their email.

## How it works

- **Invite link:** `https://your-site/?p=PARTYCODE`. The link preview shows the party name. A QR code is available in the host page but the link is the main way in.
- **Camera:** live preview with a film look (Classic disposable, Golden hour, Cool 35mm, Black and white). The host picks the default, and every guest can switch looks with the buttons under the viewfinder. Each shot gets the look baked in. No preview after the shot.
- **Flash:** the lightning button. Android rear cameras use the real torch. The front camera lights the screen white. iPhones have no torch for web pages, so the rear camera uses a simulated direct-flash look instead.
- **10 shot limit:** counted in the database per email, so refreshing or re-entering the same email does not reset it.
- **Roll end time:** the host picks a clock time. After it, the server refuses new shots and the camera shows "The roll has ended". The host can also end the roll right now.
- **Gallery:** one shared page. Sign in with the party code and the email you joined with (or use the personal link in the email). Search by name, or tap **My photos**. Names are an overlay on the page, not in the image file, so saved photos are clean.
- **Host:** `/host` to create the party, copy the invite link, set the end time and film look, see guests, and send the gallery.

## Setup (about 30 minutes)

### 1. Supabase (database and photo storage)
1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it.
3. Open **Project Settings > API**. Copy the **Project URL** and the **service_role** key. Keep the service_role key secret.

### 2. Email (Gmail, no domain needed)
Turn on 2-step verification on a Google account, then create an App Password at myaccount.google.com/apppasswords. You will use `GMAIL_USER` and `GMAIL_APP_PASSWORD`. Limit is roughly 500 emails a day, plenty for a party. (Resend only emails other people once you verify a domain you own, so skip it for now.)

### 3. Deploy on Vercel
1. Put this folder in a GitHub repo.
2. Import the repo at vercel.com. No build settings needed.
3. Add the variables from `.env.example` under **Settings > Environment Variables**. `SITE_URL` is your final URL, for example `https://embers-yourname.vercel.app`.
4. Redeploy after adding variables.

### 4. Run your party
1. Go to `https://your-site/host`, create the party, and set a host password.
2. Set **when the roll ends** and pick a **film look**.
3. Copy the invite link and send it to the group chat.
4. Next day, open `/host`, log in with the party code and password, and press **Send the gallery**.

## Test before the party
- Join on an iPhone in Safari and on an Android in Chrome. Take all 10 shots.
- Try all 4 looks and the flash on both phones, front and back camera.
- Refresh and re-enter the same email: the counter must stay at 0.
- Set the end time 2 minutes away. The camera should close and say "The roll has ended".
- Open the invite link from inside Instagram: you should see the "open in Safari/Chrome" warning.
- Paste the invite link into iMessage or WhatsApp and check the preview shows the party name.
- Press **Send the gallery** with 2 or 3 test guests. Check the emails arrive (and check spam).
- Open the gallery with the party code and a guest email. Try the name search.
- Save a photo from the gallery and confirm there is no name on it.

## Known limits
- Someone with a second real email address can verify it and get another roll.
- The gallery is gated by the party code plus an email that joined. Someone who knows both can get in, which is intended for a friend group. There is no rate limit on gallery sign-in yet, so add one before making this public.
- Web push notifications are not included. Email is the notification.
- Not built yet: removing a guest or a photo from the host page, and closing joining separately from the camera.
