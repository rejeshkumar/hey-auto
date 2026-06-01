# Cloudflare R2 Setup Guide — Hey Auto
## File Storage for Driver KYC Documents & Photos

**Time required:** 15–20 minutes  
**Cost:** Free (up to 10GB storage + 1M operations/month)  
**What this enables:** Driver licence, insurance, RC book, and profile photos stored permanently — survives Railway redeploys

---

## Before You Start

You will need:
- A Cloudflare account (free at cloudflare.com — no credit card needed for R2 free tier)
- Access to your Railway project dashboard
- The Hey Auto server already deployed on Railway

---

## PART 1 — Create Your Cloudflare Account

**Skip this part if you already have a Cloudflare account.**

### Step 1.1 — Sign up

1. Open your browser and go to **cloudflare.com**
2. Click the **Sign Up** button (top right)
3. Enter your email address and choose a password
4. Click **Create Account**
5. Cloudflare will send a verification email — open it and click **Verify email**
6. You will land on the Cloudflare dashboard home page

---

## PART 2 — Create Your R2 Bucket

This is where your files will actually be stored.

### Step 2.1 — Open R2

1. In the left sidebar of the Cloudflare dashboard, scroll down and click **R2 Object Storage**
2. If this is your first time, Cloudflare will show you an R2 overview page with pricing information
3. Click the **Create bucket** button (blue, top right)

### Step 2.2 — Name your bucket

1. In the **Bucket name** field, type exactly:
   ```
   heyauto-uploads
   ```
   > Important: bucket names must be lowercase, no spaces. Use hyphens only.

2. Under **Location**, leave it as **Automatic** — Cloudflare will pick the closest region

3. Under **Default storage class**, leave it as **Standard**

4. Click **Create bucket** at the bottom

5. You will see a success message and land on the bucket's detail page. The bucket is now ready — it is empty for now.

### Step 2.3 — Note your Account ID

1. Look at the URL bar in your browser. It will look like:
   ```
   https://dash.cloudflare.com/abc123def456.../r2/buckets/heyauto-uploads
   ```
   The long string after `dash.cloudflare.com/` is your **Account ID**

2. Copy and save it somewhere — you will need it in Part 4

   Alternatively:
   - Click **R2 Object Storage** in the left sidebar to go back to the R2 home
   - Your Account ID is shown on the right side of the page under **Account details**

---

## PART 3 — Create an API Token

This is the credential your Hey Auto server will use to upload files to R2.

### Step 3.1 — Open API Token settings

1. From the R2 home page (left sidebar → R2 Object Storage), look at the top right of the page
2. Click **Manage R2 API Tokens**
3. You will see a list of tokens (empty if this is your first one)
4. Click **Create API Token** (top right)

### Step 3.2 — Configure the token

1. **Token name** — enter:
   ```
   hey-auto-server
   ```

2. **Permissions** — you will see a dropdown that says "Admin Read & Write". Change it to:
   - Select **Object Read & Write**
   - This gives upload and download access but not bucket management — more secure

3. **Specify bucket** — you will see an option to apply to all buckets or a specific one
   - Select **Apply to specific bucket only**
   - Choose **heyauto-uploads** from the dropdown

4. **TTL (expiry)** — leave as **No expiry** for production use

5. Click **Create API Token** at the bottom

### Step 3.3 — Copy your credentials — do this NOW

Cloudflare will show you the token credentials **only once**. You cannot retrieve them again after closing this page.

You will see three values — copy all three immediately:

```
Access Key ID:       (looks like: abc123DEF456...)
Secret Access Key:   (looks like: xyz789...)
```

The page also reminds you of your **Account ID** at the top.

> Tip: paste all three into a temporary notes file right now so you don't lose them. You will add them to Railway in the next step.

Click **Finish** once you have copied everything.

---

## PART 4 — Add Credentials to Railway

This is where you connect Hey Auto's server to your R2 bucket.

### Step 4.1 — Open your Railway project

1. Go to **railway.app** and sign in
2. Click on your **Hey Auto** project
3. Click on the **server** service (the Node.js backend)

### Step 4.2 — Open environment variables

1. Click the **Variables** tab at the top of the service panel
2. You will see a list of your existing environment variables
3. Click **New Variable** (or **Add Variable** — the button may vary)

### Step 4.3 — Add the R2 variables

Add each of the following as a separate variable. Click **Add** after each one:

| Variable Name | Value |
|--------------|-------|
| `R2_ACCOUNT_ID` | Your Cloudflare Account ID (from Step 2.3) |
| `R2_ACCESS_KEY_ID` | Access Key ID (from Step 3.3) |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key (from Step 3.3) |
| `R2_BUCKET_NAME` | `heyauto-uploads` |
| `R2_PUBLIC_URL` | *(leave empty for now — see Part 5 for optional custom domain)* |

> Do not paste the variable names with the `=` sign — Railway has separate fields for name and value.

### Step 4.4 — Save and deploy

1. Once all 4 variables are added, click **Deploy** (or Railway may auto-deploy — you will see a spinning indicator)
2. Click the **Deployments** tab to watch the build progress
3. Wait for the status to show **Success** (green tick) — usually takes 60–90 seconds
4. Click the deployment to see the build logs — you should NOT see any errors related to storage

---

## PART 5 — Verify It Is Working

### Step 5.1 — Check the server health log

1. In Railway, go to your server service → **Deployments** → click the latest deployment → **View logs**
2. Look for a line that says something like:
   ```
   Server running on port 3000
   ```
3. Importantly, you should NOT see:
   ```
   No cloud storage configured... Files will be saved locally
   ```
   If you do see that warning, one of your R2 env vars is missing or has a typo — go back to Step 4.3

### Step 5.2 — Test a real upload

1. Open the Hey Auto **admin console** at:
   ```
   https://hey-auto-server-production.up.railway.app/admin
   ```
2. Log in with the admin phone number (+919999999999, OTP 123456 in dev/staging)
3. Go to **Drivers** → click any test driver
4. Try uploading a document (any image file from your computer)
5. If successful, the document status will change and the image will display — it is now stored in R2

### Step 5.3 — Confirm in Cloudflare dashboard

1. Go back to **dash.cloudflare.com** → **R2** → **heyauto-uploads** bucket
2. Click on the **Objects** tab
3. You should see the uploaded file listed, inside a `documents/` folder
4. The filename will look like: `documents/1716123456789-abc123.jpg`

If the file appears here, the integration is working correctly. All future driver document uploads will be stored here permanently — they will not be lost when Railway redeploys.

---

## PART 6 — Optional: Custom Domain for File URLs (Recommended Before Public Launch)

By default, files will be served from a Cloudflare dev URL like:
```
https://pub-abc123.r2.dev/documents/filename.jpg
```

Before your public launch, it is better to serve files from your own domain:
```
https://files.heyauto.in/documents/filename.jpg
```

### Step 6.1 — Enable public access on the bucket

1. In Cloudflare → R2 → **heyauto-uploads** bucket
2. Click the **Settings** tab
3. Under **Public Access**, click **Allow Access**
4. Cloudflare will give you an r2.dev subdomain — note it down

### Step 6.2 — Add a custom domain (optional)

1. In the same Settings page, under **Custom Domains**, click **Connect Domain**
2. Enter: `files.heyauto.in` (or whatever subdomain you prefer)
3. Cloudflare will automatically create the DNS record if your domain is on Cloudflare
4. If your domain is not on Cloudflare, you will need to add a CNAME record at your DNS provider

### Step 6.3 — Update the Railway env var

1. Go back to Railway → your server service → Variables
2. Set `R2_PUBLIC_URL` to:
   ```
   https://files.heyauto.in
   ```
3. Redeploy — all new file uploads will now return URLs on your custom domain

> Note: Existing file URLs stored in the database will still use the old r2.dev URL. You only need to do a URL migration if you want to update old records — not necessary for MVP.

---

## Troubleshooting

### "No cloud storage configured" in logs
- One or more of the 4 R2 env vars is missing or has a typo
- Check that `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` are all set in Railway
- Variable names are case-sensitive — must be exactly as shown

### "Access Denied" or 403 error when uploading
- The API token permissions are wrong
- Go to Cloudflare → R2 → Manage R2 API Tokens → delete the old token → create a new one with **Object Read & Write** on the `heyauto-uploads` bucket

### "NoSuchBucket" error
- The bucket name in `R2_BUCKET_NAME` does not match the actual bucket name in Cloudflare
- Check spelling — it must be exactly `heyauto-uploads`

### File uploads succeed but images don't display in the app
- The bucket does not have public access enabled
- Go to Cloudflare → R2 → heyauto-uploads → Settings → Public Access → Allow Access
- Or set up a custom domain (Part 6)

### Upload works locally but not on Railway
- Railway env vars were not saved before deploying
- Go to Variables tab, confirm all 4 R2 vars are present, then click Deploy again

---

## Summary — What You Did

```
Cloudflare Account
    └── R2 Bucket: heyauto-uploads
            └── API Token: hey-auto-server (Object Read & Write)
                    └── Credentials added to Railway env vars
                            └── Hey Auto server now uploads to R2 on every
                                driver document / photo submission
```

**Files are now stored permanently.** Railway can redeploy, restart, or crash — your driver KYC documents are safe in Cloudflare R2.

---

*Next step after this: Set up Firebase Cloud Messaging (FCM) for push notifications — see `FIREBASE_SETUP_GUIDE.md` (coming soon)*
