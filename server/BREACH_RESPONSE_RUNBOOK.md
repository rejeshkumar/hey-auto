# Data Breach Response Runbook
### DPDP Act 2023 §8(6) — Aye Auto / Navam Works LLP

---

## What counts as a breach

Any unauthorised access, disclosure, alteration, or destruction of personal data including:
- Leaked phone numbers, names, emails, or ride history
- Unauthorised DB access / compromised credentials
- AWS S3 bucket made public accidentally
- Stolen JWT secret key
- Any Railway/Postgres breach notification from infrastructure provider

---

## Step 1 — Contain (within 1 hour)

1. **Rotate all secrets immediately**
   - Railway → Settings → Variables: rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` password
   - Revoke all active refresh tokens: `DELETE FROM refresh_tokens;`
   - Rotate `FAST2SMS_API_KEY`, `CASHFREE_SECRET_KEY`, `SARVAM_API_KEY`

2. **Isolate if needed**
   - If DB is actively breached: Railway → Postgres → Suspend DB
   - If server is compromised: Railway → Deployments → Suspend

3. **Preserve evidence**
   - Export Railway logs before rotating secrets
   - Screenshot any anomalous admin console activity

---

## Step 2 — Assess (within 4 hours)

Answer these questions:
- What data was exposed? (phone, name, ride history, government IDs, payment info)
- How many users affected?
- Was the breach accidental (misconfiguration) or malicious (active attack)?
- Is it ongoing or contained?

---

## Step 3 — Notify (within 72 hours of discovery)

### A — Notify Data Protection Board (DPDP §8(6))
Once the DPB is constituted (expected ~2027), file a breach notification at their portal.
Until then: document the breach internally with date, scope, and actions taken.

**Email template to DPB:**
```
Subject: Personal Data Breach Notification — Aye Auto / Navam Works LLP

Data Fiduciary: Navam Works LLP, Taliparamba, Kannur, Kerala 670141
Contact: privacy@heyauto.in

Date/Time of Discovery: [DATE TIME IST]
Estimated Date of Breach: [DATE]
Number of Affected Individuals: [N]
Nature of Data Affected: [phone numbers / names / ride history / government IDs]

Description:
[2-3 sentences on what happened]

Immediate Steps Taken:
[List containment actions from Step 1]

Measures to Prevent Recurrence:
[List]
```

### B — Notify Affected Users
Send in-app notification + email (if email on file) within 72 hours.

**In-app notification template:**
```
Subject: Important: Security Notice from Aye Auto

We recently discovered a security incident that may have affected your account data.

What happened: [brief description]
What data was involved: [phone number / ride history]
What we did: We immediately [rotated keys / suspended access / patched the vulnerability].
What you should do: [e.g. "No action needed" or "Please re-login to your account"]

For questions: privacy@heyauto.in
Grievance Officer: Navam Works LLP, Taliparamba, Kannur, Kerala
```

---

## Step 4 — Remediate

- Patch the vulnerability that caused the breach
- Add the breach to internal incident log (date, scope, resolution)
- Schedule a post-mortem within 7 days
- Update this runbook with lessons learned

---

## Contact

| Role | Contact |
|------|---------|
| Grievance Officer / DPO | privacy@heyauto.in |
| Technical Lead | rejesh@gmail.com |
| Railway Support | railway.app/help |

---

*Last updated: 2026-06-24*
*DPDP Act 2023 §8(6) requires notification to the Data Protection Board and affected Data Principals without undue delay.*
