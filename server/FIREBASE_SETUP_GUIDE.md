# Firebase FCM Setup Guide — Hey Auto
## Push Notifications for Rider & Driver Apps

**Time required:** 20–25 minutes  
**Cost:** Free (Firebase Spark plan is sufficient)  
**What this enables:** Drivers receive ride request alerts even when the app is closed or backgrounded. Riders receive trip updates, driver arrival alerts, and cancellation notices.

---

## How Push Notifications Work in Hey Auto

Understanding this flow will help you debug if something goes wrong:

```
Hey Auto Server
    │
    │  Sends push via Expo's API
    │  POST https://exp.host/--/api/v2/push/send
    │  { to: "ExponentPushToken[xxx]", title: "...", body: "..." }
    ▼
Expo Push Service
    │
    │  Uses your FCM Server Key to deliver
    │  to Android devices via Google FCM
    │
    ├──► Google FCM ──► Driver Android Phone
    │
    └──► Apple APNs ──► Driver iPhone (if applicable)
```

**Key point:** Your server never calls Firebase directly. It sends to Expo, and Expo handles FCM delivery using the Server Key you register in the Expo dashboard. This is why the setup is simpler than a direct FCM integration.

---

## Before You Start

You will need:
- A Google account (any Gmail account)
- Access to the Expo dashboard (expo.dev — use the same account as the EAS builds)
- The Expo project IDs from the apps:
  - Driver app: `63955e68-b790-4b60-a828-f1108e1bac6f`
  - Rider app: `e81ff950-99f7-45d1-9a93-277920334268`

---

## PART 1 — Create a Firebase Project

### Step 1.1 — Open Firebase Console

1. Go to **console.firebase.google.com** in your browser
2. Sign in with your Google account
3. You will land on the Firebase console home page

### Step 1.2 — Create a new project

1. Click **Add project** (or **Create a project** if this is your first)
2. **Project name** — enter:
   ```
   hey-auto
   ```
3. Click **Continue**
4. On the next screen — **Google Analytics** — you can turn this **off** (not needed for push notifications)
5. Click **Create project**
6. Wait about 30 seconds while Firebase sets up the project
7. Click **Continue** when it says "Your new project is ready"
8. You will land on the Firebase project dashboard

---

## PART 2 — Get the FCM Server Key

This is the credential that lets Expo deliver push notifications on your behalf.

### Step 2.1 — Open Project Settings

1. In the Firebase dashboard, click the **gear icon** (⚙️) next to "Project Overview" in the top left
2. Click **Project settings**

### Step 2.2 — Go to Cloud Messaging tab

1. Click the **Cloud Messaging** tab (along the top)
2. You will see a section called **Cloud Messaging API (Legacy)**
   > Note: Google has a new Firebase Cloud Messaging API (v1) but Expo currently requires the Legacy Server Key. Use the Legacy one.
3. If it says "Firebase Cloud Messaging API (Legacy) — Disabled", click the three dots (⋮) next to it and click **Enable**
4. Wait a few seconds and refresh the page
5. You will now see a **Server key** field with a long string starting with `AAAA...`
6. Click the copy icon next to the Server Key — save it somewhere temporarily

### Step 2.3 — Save the Server Key for reference

The Server Key looks like this (example — yours will be different):
```
AAAAxyz123...:APA91bHPRgkFLJu...
```

Save it in a note — you will paste it into the Expo dashboard in Part 3, and optionally into Railway in Part 4.

---

## PART 3 — Register FCM Key in the Expo Dashboard

This is the step that actually connects Firebase to your apps.

### Step 3.1 — Open Expo dashboard

1. Go to **expo.dev** in your browser
2. Sign in with the Expo account that owns the Hey Auto project (username: `rejesh`)

### Step 3.2 — Add FCM key to the Driver App

1. In the Expo dashboard, click on **Projects** in the left sidebar
2. Find the project with ID `63955e68-b790-4b60-a828-f1108e1bac6f` — this is the Driver App
   (it may be listed as "hey-auto-driver" or "Aye Auto Driver")
3. Click on the project to open it
4. Click **Push notifications** in the left sidebar
5. Under **Android FCM V1 / Legacy credentials**, click **Add credential** (or you may see a field labelled **FCM Server Key**)
6. Paste the Server Key you copied in Step 2.3
7. Click **Save**
8. You should see a green confirmation: "FCM credential saved"

### Step 3.3 — Add FCM key to the Rider App

1. Go back to **Projects** in the Expo dashboard
2. Find the project with ID `e81ff950-99f7-45d1-9a93-277920334268` — this is the Rider App
   (it may be listed as "hey-auto-rider" or "Aye Auto")
3. Click on the project → **Push notifications**
4. Paste the same Server Key again
5. Click **Save**

Both apps now have FCM configured in Expo. When a user installs the app, Expo will register their device with FCM and give them an `ExponentPushToken` — which Hey Auto stores in the database and uses to send notifications.

---

## PART 4 — Add Android Notification Channel to the Apps (Already Done)

Good news: the code is already in place. Both apps have the `rides` notification channel configured in `pushNotifications.ts`:

```ts
// Already in apps/driver-app/src/services/pushNotifications.ts
await Notifications.setNotificationChannelAsync('rides', {
  name: 'Ride Requests',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#F5C800',
  sound: 'default',
});
```

And the server sends to this channel:
```ts
// Already in server/src/modules/notification/notification.service.ts
channelId: 'rides',
priority: 'high',
```

No code changes needed here.

---

## PART 5 — Rebuild the APKs

The FCM credential is baked into the APK at build time. Since you have added the FCM key to the Expo dashboard, you need to rebuild both APKs for the change to take effect.

### Step 5.1 — Install EAS CLI (if not already installed)

Open a terminal and run:
```bash
npm install -g eas-cli
```

Then log in to your Expo account:
```bash
eas login
```
Enter your Expo username (`rejesh`) and password when prompted.

### Step 5.2 — Rebuild the Driver App

```bash
cd "/Users/rejesh.kumar/Desktop/Project- AI/Hey Auto/apps/driver-app"
eas build --platform android --profile preview
```

- `--profile preview` builds an APK (installable directly, no Play Store needed)
- `--profile production` builds an AAB (for Play Store submission)

The build will be queued on Expo's build servers. You will see a URL like:
```
Build in progress: https://expo.dev/accounts/rejesh/projects/hey-auto-driver/builds/xxx
```

Wait for it to complete (usually 5–10 minutes). When done, you will get a download link for the APK.

### Step 5.3 — Rebuild the Rider App

```bash
cd "/Users/rejesh.kumar/Desktop/Project- AI/Hey Auto/apps/rider-app"
eas build --platform android --profile preview
```

Wait for completion and download the APK.

### Step 5.4 — Install the new APKs

Uninstall the old APKs from your test devices first (to avoid token conflicts), then install the new ones:

```bash
# Connect test device via USB with USB debugging enabled
adb uninstall in.heyauto.driver
adb install path/to/hey-auto-driver.apk

adb uninstall in.heyauto.rider
adb install path/to/hey-auto-rider.apk
```

Or simply share the APK download link with your test drivers/riders — they install over the existing app.

---

## PART 6 — Test That Push Notifications Work

### Step 6.1 — Trigger a token registration

1. Install the new driver APK on a test Android phone
2. Open the app and log in (use +918095481555, OTP 123456)
3. When prompted, tap **Allow** when the app asks for notification permission
4. The app will call `PUT /api/v1/notification/fcm-token` automatically on login
5. The token is now saved in the database

### Step 6.2 — Verify the token was saved

Check in Railway logs or the database:

```sql
-- Run in Railway PostgreSQL console or pgAdmin
SELECT id, phone, "fcmToken"
FROM "User"
WHERE phone = '+918095481555';
```

The `fcmToken` field should contain a value starting with `ExponentPushToken[`.

If it is null, the permission was denied or the token registration call failed — check Railway logs for `PUT /notification/fcm-token`.

### Step 6.3 — Send a test notification

Use the Expo Push Tool to send a test notification without needing a full ride flow:

1. Go to **expo.dev/notifications** in your browser
2. Paste the `ExponentPushToken[xxx]` value from Step 6.2
3. Set **Title** to: `Test Ride Request`
4. Set **Body** to: `Pickup: Taliparamba Bus Stand`
5. Click **Send notification**
6. The notification should appear on the test phone within 2–3 seconds

**If the app is open:** The notification should appear as a banner at the top (handled by `setNotificationHandler` in the app).

**If the app is closed/backgrounded:** The notification should appear in the system notification tray. This is the critical scenario — if this works, FCM is fully configured.

### Step 6.4 — Test via a real ride request

1. Open the **rider app** on a second device, log in, and request a ride
2. On the driver device, **close the driver app completely** (swipe it away from recents)
3. In the rider app, confirm the ride request
4. Within 5–10 seconds, a push notification should arrive on the driver's phone:
   ```
   New Ride Request
   Pickup: [address] · ₹[fare]
   ```
5. Tapping the notification should open the driver app and show the ride request

---

## PART 7 — Store FCM Key in Railway (Optional but Recommended)

You do not need to add Firebase credentials to Railway — the server sends via Expo and does not call Firebase directly. However, storing the FCM Server Key in Railway is good practice for reference and future use:

1. Go to Railway → your server service → **Variables**
2. Add one new variable:

   | Name | Value |
   |------|-------|
   | `FCM_SERVER_KEY` | Your FCM Server Key from Step 2.3 |

3. This is informational only — the server does not use it at runtime in the current architecture.

---

## Troubleshooting

### Notification permission prompt never appears on the device
- The app is asking for permission at login. If the user previously denied it, Android will not show the prompt again automatically.
- Fix: Go to phone **Settings → Apps → Aye Auto Driver → Notifications → Allow**

### `ExponentPushToken` is saved but no notification arrives
- The FCM Server Key was not added to the Expo dashboard before the APK was built
- Fix: Verify the key is in the Expo dashboard (Part 3), then rebuild the APK (Part 5)

### Notification arrives when app is open but not when backgrounded
- This is specifically an FCM issue — background delivery requires the FCM key to be registered
- Fix: Rebuild the APK after adding the FCM key (Part 5)

### `PUT /notification/fcm-token` returns 401
- The user's JWT token has expired
- Fix: The app should auto-refresh the token on login — check `useAuthStore` in the driver app

### `PUT /notification/fcm-token` returns 500
- Database `fcmToken` column may not exist in the Railway PostgreSQL instance
- Fix: Run the latest migration on Railway:
  ```bash
  railway run --service server npx prisma migrate deploy
  ```

### Expo Push Tool says "DeviceNotRegistered"
- The token is stale — the app was uninstalled and reinstalled without updating the token
- Fix: Log out and log back in on the device to re-register the token

### Both apps get notifications but only the driver app matters for ride requests
- Correct — the rider app notifications (trip updates, driver arrival) will also work once the FCM key is registered. Only the driver app backgrounded notification is a hard blocker for go-live.

---

## What Each Notification Does

| Trigger | Recipient | Title | When Sent |
|---------|-----------|-------|-----------|
| Ride requested | Driver | "New Ride Request" | Ride matching starts |
| Driver assigned | Rider | "Driver on the way" | Driver accepts ride |
| Driver arrived | Rider | "Your driver has arrived" | Driver taps Arrived |
| Ride started | Rider | "Ride started" | OTP verified, ride begins |
| Ride completed | Rider | "Ride completed · ₹X" | Ride ends |
| Ride cancelled | Both | "Ride cancelled" | Either party cancels |
| No drivers found | Rider | "No drivers available" | All matching rounds fail |

All of these are already wired in `ride.service.ts` and `socket/handler.ts` — they will start working as soon as the FCM key is registered and APKs are rebuilt.

---

## Summary

```
Firebase Console
    └── Project: hey-auto
            └── Cloud Messaging (Legacy) → Server Key: AAAA...
                    │
                    ▼
            Expo Dashboard
                └── Driver App (63955e68...) → FCM Server Key added
                └── Rider App  (e81ff950...) → FCM Server Key added
                        │
                        ▼
                EAS Build → New APKs (with FCM baked in)
                        │
                        ▼
                Driver installs APK → grants notification permission
                → ExponentPushToken[xxx] saved in database
                        │
                        ▼
                Ride requested → server sends to Expo API
                → Expo delivers via FCM → notification on driver phone ✅
```

**Once this is done:** FCM is the last infrastructure blocker before go-live. Combined with R2 (file storage), Fast2SMS (OTP), and this Firebase setup, the platform is ready for a closed beta with real drivers in Taliparamba.

---

*Previous guide: `server/R2_SETUP_GUIDE.md` — Cloudflare R2 file storage*  
*Next: Sentry error monitoring — `server/SENTRY_SETUP_GUIDE.md` (coming soon)*
