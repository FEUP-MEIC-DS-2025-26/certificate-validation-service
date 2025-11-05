# Environment & Credentials Setup Guide

## 🎯 Quick Overview

This service has **two environments** with **different authentication methods**:

| Environment | Pub/Sub | Storage/Firestore | Authentication |
|------------|---------|-------------------|----------------|
| **Local Dev** | Emulator (localhost:8085) | Real GCP | `service-account-key.json` file |
| **Production (Cloud Run)** | Real Pub/Sub* | Real GCP | Workload Identity (automatic) |

_*Pub/Sub is managed by another team_

---

## 🔐 Authentication Explained

### Local Development
```
Your Code → GOOGLE_APPLICATION_CREDENTIALS → service-account-key.json → GCP
```
- Uses a **key file** stored locally
- File is in `.gitignore` (never committed)
- Each developer needs their own copy

### GitHub Actions (Deployment)
```
GitHub Actions → secrets.GCP_CREDENTIALS → Deploys to Cloud Run
```
- Uses GitHub Secret to **deploy** the application
- Secret is encrypted, not in code
- Only used during deployment, not runtime

### Production (Cloud Run Runtime)
```
Cloud Run → Workload Identity → GCP (automatic)
```
- **No credentials needed!**
- Service account identity is automatic
- More secure (no keys to steal)

---

## 💻 Local Development Setup

### 1. Get Service Account Key

**Option A: Create your own**
```bash
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=certificate-validation-sa@made-in-portugal-dsle.iam.gserviceaccount.com
```

**Option B: Get from team lead**
- They'll share `service-account-key.json` securely (NOT via Git)
- Place it in the project root

### 2. Create .env File
```bash
cp .env.example .env
```

Your `.env` should contain:
```bash
# Pub/Sub (local emulator)
PUBSUB_EMULATOR_HOST=localhost:8085
PROJECT_ID=test-project
REQUEST_TOPIC=CertificatesRequestTopic
RESPONSE_TOPIC=CertificatesResponseTopic
REQUEST_SUBSCRIPTION=CertificatesRequestSubscription
RESPONSE_SUBSCRIPTION=CertificatesResponseSubscription

# GCP (real services)
GCP_PROJECT_ID=made-in-portugal-dsle
GCS_BUCKET_NAME=made-in-portugal-certificates
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 3. Start Pub/Sub Emulator
```bash
docker run -d --name pubsub-emulator -p 8085:8085 dipjyotimetia/pubsub-emulator:latest
```

### 4. Run Application
```bash
# Terminal 1 - Server
bun run server.ts

# Terminal 2 - Client (for testing)
bun run client.ts
```

---

## 🚀 GitHub & Production Setup

### GitHub Secret (Already Configured ✅)

Your workflow already uses:
```yaml
- name: Set up Google Cloud authentication
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_CREDENTIALS }}
```

**Secret Details:**
- **Name:** `GCP_CREDENTIALS`
- **Format:** Plain JSON (not base64)
- **Contains:** Service account key JSON
- **Purpose:** Allows GitHub Actions to deploy to GCP

### How to Update the Secret (if needed)

**Via GitHub Web UI:**
1. Go to: **Settings → Secrets and variables → Actions**
2. Click `GCP_CREDENTIALS` to edit
3. Paste the raw JSON content of `service-account-key.json`
4. Click **Update secret**

**Via GitHub CLI:**
```bash
gh secret set GCP_CREDENTIALS < service-account-key.json
```

### Verify Secret Exists
```bash
gh secret list
# Should show: GCP_CREDENTIALS
```

---

## 🔄 The Complete Flow

### 1. Development (Your Machine)
```
You write code
  ↓
.env → GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
  ↓
Code accesses Storage/Firestore using key file
  ↓
Test locally with emulator
```

### 2. Deployment (GitHub Actions)
```
git push → Triggers workflow
  ↓
GitHub Actions authenticates with secrets.GCP_CREDENTIALS
  ↓
Builds Docker image (NO credentials inside!)
  ↓
Pushes to Artifact Registry
  ↓
Deploys to Cloud Run with:
  --service-account=certificate-validation-sa@...
  ↓
✅ Deployment complete
```

### 3. Production (Cloud Run)
```
Request comes in
  ↓
Cloud Run: "I AM certificate-validation-sa" (automatic identity)
  ↓
Code accesses Storage/Firestore
  ↓
GCP: "Identity verified via Workload Identity"
  ↓
✅ Access granted (no key file needed!)
```

---

## 📂 What's in Git vs What's Not

### ✅ Committed to Git
- `.env.example` (template)
- `.gitignore` (blocks sensitive files)
- Documentation files
- Source code
- Dockerfile (no credentials inside)

### ❌ NOT in Git (blocked by .gitignore)
- `.env` (your local config)
- `service-account-key.json` (credentials)
- `service-account-key-base64.txt` (if created)
- `*-key.json` (any key files)

### 🔒 In GitHub Secrets (encrypted)
- `GCP_CREDENTIALS` (for deployment)

---

## 🆘 Troubleshooting

### Local: "Could not load credentials"
```bash
# Check key file exists
ls -la service-account-key.json

# Check .env file
cat .env | grep GOOGLE_APPLICATION_CREDENTIALS

# Verify not committed to Git
git status  # Should NOT show these files
```

### Local: "Connection refused" (Pub/Sub)
```bash
# Check emulator is running
docker ps | grep pubsub-emulator

# Start if not running
docker run -d --name pubsub-emulator -p 8085:8085 dipjyotimetia/pubsub-emulator:latest
```

### Production: "Could not load credentials"
- **This error is misleading in Cloud Run!**
- Check Cloud Run logs for the real error
- Verify service account has IAM permissions:
  ```bash
  gcloud projects get-iam-policy made-in-portugal-dsle \
    --flatten="bindings[].members" \
    --filter="bindings.members:certificate-validation-sa@*"
  ```

### GitHub Actions: Deployment fails
```bash
# Verify secret exists
gh secret list

# Check workflow logs
gh run list
gh run view <run-id>
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep `service-account-key.json` only on your local machine
- Use `.gitignore` to block sensitive files
- Use GitHub Secrets for CI/CD credentials
- Use Workload Identity in production
- Rotate keys periodically

### ❌ DON'T:
- Never commit `.env` or `*-key.json` files
- Never share keys via chat/email
- Never put credentials in Dockerfile
- Never log credentials
- Never store credentials in code

---

## 📞 Pub/Sub Requirements (Other Team)

**Pub/Sub infrastructure is managed by another team.**

Send them `PUBSUB_REQUIREMENTS.md` - they need to:
1. Create 4 Pub/Sub resources (2 topics + 2 subscriptions)
2. Grant permissions to: `certificate-validation-sa@made-in-portugal-dsle.iam.gserviceaccount.com`

Required permissions:
- `roles/pubsub.publisher` on both topics
- `roles/pubsub.subscriber` on both subscriptions

---

## 🎓 Key Concepts

### Why Three Different Authentication Methods?

1. **Local (service-account-key.json):**
   - You're outside GCP, need to prove identity
   - Key file is like a password

2. **GitHub Actions (secrets.GCP_CREDENTIALS):**
   - GitHub is outside GCP, needs to deploy
   - Secret stored securely, used only during deployment

3. **Production (Workload Identity):**
   - Application runs inside GCP
   - Identity is automatic, no keys needed
   - Most secure method

### Why No Credentials in Docker Image?

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile
COPY . .        # ← Copies code, but .gitignore blocks *.json keys
EXPOSE 8080
CMD ["bun", "run", "server.ts"]
```

- Docker image is built from Git repository
- `.gitignore` blocks `service-account-key.json`
- Even if you tried to copy it, it's not there!
- Production uses Workload Identity instead

---

## ✅ Quick Verification

Check your setup is secure:
```bash
# Verify sensitive files are ignored
git status --ignored | grep -E "(\.json|\.env)"

# Verify they're not tracked
git ls-files | grep -E "(service-account|\.env$)"
# Should show nothing

# Verify you can run locally
docker ps | grep pubsub-emulator && echo "✅ Emulator running"
bun run server.ts  # Should start without errors
```

---

## 🚀 Ready to Deploy?

```bash
# Commit your changes
git add .
git commit -m "Your commit message"

# Push to trigger deployment
git push origin main

# Monitor deployment
gh workflow run build-and-deploy.yml
gh run watch
```

---

## 📚 Additional Resources

- **PUBSUB_REQUIREMENTS.md** - Requirements for infrastructure team
- **ENVIRONMENT_SETUP.md** - Detailed technical guide (if needed)
- [Google Cloud Authentication](https://cloud.google.com/docs/authentication)
- [Workload Identity](https://cloud.google.com/run/docs/securing/service-identity)
