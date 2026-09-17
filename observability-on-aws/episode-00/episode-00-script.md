# Episode 0 — Setup: Account, Tools, and the Demo App

**Course:** Observability on AWS: From Console.log to On-Call
**Episode type:** Unlisted prerequisite / setup video
**Target length:** 12–14 minutes
**Repo branch:** `episode-00-setup`
**Artifacts in this folder:** this script (md + docx), slides (pptx), voiceover text (txt), audio generator (js), demo commands (sh)

---

## Learning objectives

By the end of this episode, a viewer will have:

1. A fresh AWS account configured safely — IAM user (not root), MFA, and a $10 budget alarm.
2. AWS CLI v2 installed and configured with a named profile.
3. Node.js 20+, TypeScript, and the AWS CDK-free toolchain we use (plain CLI + scripts).
4. The demo app — a TypeScript URL shortener backed by DynamoDB — running locally.
5. The starter repo cloned, with the branch-per-episode convention understood.
6. The teardown philosophy internalized: nothing stays running between recording/practice sessions.

**Deliberately absent:** any observability. The app has zero logging, zero metrics, zero tracing. That is the point — the course adds each layer on camera.

---

## Slide-by-slide script

Format for each slide: **SLIDE** (what's on screen) → **VOICEOVER** (read into ElevenLabs; also in `episode-00-voiceover.txt` chunked for the generator) → **DEMO** blocks where applicable, flagged PRESCRIPTIVE (follow exactly) or DIRECTIONAL (improvise around the goal).

---

### Slide 1 — Title

**On screen:** Course title, episode number, "Setup: Account, Tools, and the Demo App", jonathanscode.io footer.

**Voiceover:**
Welcome to Observability on AWS — From Console.log to On-Call. This is Episode Zero: the setup episode. In the next few minutes we'll create an AWS account the right way, install the tools, and build the small TypeScript app that the entire course revolves around. Nothing here is glamorous — but everything later depends on it. Let's get it done.

---

### Slide 2 — What we're building

**On screen:** Course map — 13 episodes in 5 modules. The URL shortener icon at the center.

**Voiceover:**
Quick orientation. Across this course we'll take one small application — a URL shortener written in TypeScript, backed by DynamoDB — and deploy it to AWS. Then we'll break it, on purpose, in every way production apps actually break. And we'll diagnose each failure using the right observability signal: logs, metrics, traces, audit trails, and events. By the end, you'll be able to walk into an on-call rotation — or a job interview — and triage like you've done it before. Because you will have.

---

### Slide 3 — Prerequisites

**On screen:** Checklist — a computer with a terminal, a credit card for AWS signup, a GitHub account, roughly $5–20 of AWS spend if you follow teardown discipline.

**Voiceover:**
What you need: a machine with a terminal — Mac, Linux, or Windows with WSL. A credit card for the AWS signup — we'll set a budget alarm so you don't get surprised. A GitHub account. And a fair warning about cost: if you tear down resources after each session like I'll show you, the whole course costs somewhere between five and twenty dollars. If you leave an EKS cluster running for a month, it costs seventy-three dollars just for the control plane. The teardown scripts exist for a reason. Use them.

---

### Slide 4 — AWS account: root vs IAM

**On screen:** Two-box diagram — "Root user: sign up, billing, break glass. Nothing else." vs "IAM user: everything you actually do."

**Voiceover:**
Create your AWS account at aws.amazon.com if you haven't. Now the first rule of AWS, and something interviewers genuinely ask about: the root user — the email you signed up with — is not for daily use. Root is for signup, billing, and break-glass emergencies. Everything else happens as an IAM user with only the permissions it needs. We'll create that user now, enable MFA on both identities, and never touch root again.

**DEMO — PRESCRIPTIVE (console):**

1. Sign in as root → top-right menu → **Security credentials** → enable MFA on root (authenticator app).
2. Console search → **IAM** → **Users** → **Create user**.
   - Name: `course-admin`
   - Check **Provide user access to the AWS Management Console** → **I want to create an IAM user** → set a password.
3. Permissions: **Attach policies directly** → `AdministratorAccess` (fine for a personal sandbox account; call out on camera that a real org would scope this down).
4. Create user → note the console sign-in URL (contains your account ID).
5. Sign out of root. Sign in as `course-admin`. Enable MFA on this user too (IAM → Users → course-admin → Security credentials).
6. **On camera:** blur or crop the account ID region in post (Camtasia blur region on the top-right of the console).

---

### Slide 5 — The $10 budget alarm

**On screen:** Screenshot-style mock of a Budget alert email. Amber warning styling.

**Voiceover:**
Before we create a single resource, we create the safety net. AWS Budgets will email you when your spend crosses a threshold. Ten dollars is the right number for this course — if you ever get that email, something is running that shouldn't be. This takes two minutes and it is the cheapest insurance you will ever buy.

**DEMO — PRESCRIPTIVE (console):**

1. Console search → **Billing and Cost Management** → **Budgets** → **Create budget**.
2. **Use a template** → **Monthly cost budget**.
3. Amount: `10`. Email: your address. Create.
4. Optional second budget at `$25` as a "things have gone very wrong" tripwire.

---

### Slide 6 — AWS CLI v2

**On screen:** Terminal-style code block with the three install commands per OS and `aws sts get-caller-identity` output.

**Voiceover:**
Now the CLI. Everything in this course is scripted — we click through the console when it teaches something, but the real work happens in the terminal, because scripts are repeatable and teardown-able. Install AWS CLI version two, then create an access key for your IAM user, and configure a named profile called "course". The identity check at the end proves you're calling AWS as the right user.

**DEMO — PRESCRIPTIVE (terminal):** — full commands in `episode-00-demo-commands.sh`, sections 1–2.

```bash
# Linux / WSL
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install
aws --version

# Create access key: IAM → Users → course-admin → Security credentials
# → Create access key → CLI → copy both values

aws configure --profile course
#   AWS Access Key ID:      <paste>
#   AWS Secret Access Key:  <paste>
#   Default region name:    us-east-1
#   Default output format:  json

export AWS_PROFILE=course
aws sts get-caller-identity   # → shows course-admin ARN, not root
```

**On camera:** never show the secret key. Pause recording while pasting, or type into a pre-filled prompt off-screen.

---

### Slide 7 — Toolchain (now including Terraform)

**On screen:** Version checklist: Node 20+, npm 10+, TypeScript 5+, **Terraform ≥ 1.9** (highlighted), git.

**Voiceover:**
The app side. We need Node twenty or later, TypeScript, and one more tool: Terraform, version one point nine or later — because from Episode Three onward, every piece of AWS infrastructure in this course is created with terraform apply and destroyed with terraform destroy. If you're on WSL like me, install everything inside WSL, not Windows. Check your versions match or exceed what's on screen. And to set expectations: Terraform for infrastructure, plain TypeScript for the app. No CDK, no Terragrunt, no modules — flat, readable configs, so the observability stays the star.

**Course policy (decided during pre-production):** Terraform is the course-standard IaC tool — flat configs, local state, no modules/workspaces/Terragrunt (mentioned once later as "what production adds"). First `terraform apply` happens in Episode 3; Episode 3 also keeps one 90-second beat showing the equivalent raw `aws dynamodb create-table` call, so Episode 4's CloudTrail lesson can connect "calls Terraform made on my behalf" to the audit log. Teardown story: `terraform destroy` per episode, which handles dependency ordering and half-created states better than hand-written delete scripts.

**DEMO — PRESCRIPTIVE (terminal):** `episode-00-demo-commands.sh`, section 3.

---

### Slide 8 — The demo app: architecture

**On screen:** Three-box diagram: Browser → Express (TypeScript) on :3000 → DynamoDB table `short-urls`. Three endpoints listed: `POST /shorten`, `GET /:code`, `GET /`.

**Voiceover:**
Meet the app. A URL shortener — small enough to understand in one sitting, real enough to fail in interesting ways. Three endpoints. POST to shorten takes a long URL and returns a six-character code. GET with a code redirects to the original URL. And GET on the root serves a tiny HTML form so there's something to look at. Storage is a single DynamoDB table. That's it. No auth, no queues, no caching — yet. Every piece we add later, we add because an observability lesson needs it.

---

### Slide 9 — Build it (with AI, or clone it)

**On screen:** Two paths: "Path A — prompt your AI assistant" with the prompt summary; "Path B — clone the starter repo".

**Voiceover:**
Two ways to get the app. Path A: build it yourself with an AI assistant — I'll show you the prompt I use, and honestly, watching what the assistant gets wrong is its own lesson. Path B: clone the starter branch from the course repo and follow along. Both land in the same place. On camera I'll go with Path A so you see the app come together, but there's no shame in Path B — the course is about observing the app, not writing it.

**DEMO — DIRECTIONAL (app build):** Prompt your assistant (Claude, Cursor, whatever you use) with the *goal*, not a spec dump. The shape of the prompt:

> Build a minimal TypeScript Express app: a URL shortener. Three routes — POST /shorten accepts JSON `{url}` and returns `{code}` (6-char nanoid), GET /:code 302-redirects to the stored URL or 404s, GET / serves a minimal inline HTML form that calls /shorten. Storage: DynamoDB table `short-urls`, partition key `code` (string), using @aws-sdk/client-dynamodb v3 with a DynamoDBDocumentClient. Include a local mode using dynamodb-local via docker OR an in-memory Map fallback behind an env var `STORAGE=memory`. Strict tsconfig, no logging of any kind — not even console.log. package.json scripts: dev (tsx watch), build (tsc), start.

Key requirements to enforce whatever the assistant produces:
- **Zero logging.** If it adds console.log calls (it will), remove them. The app must start silent.
- `STORAGE=memory` mode so viewers without Docker can run it instantly.
- Port from `process.env.PORT ?? 3000`.

**DEMO — PRESCRIPTIVE (run it):** `episode-00-demo-commands.sh`, section 4.

```bash
STORAGE=memory npm run dev
# browser → http://localhost:3000 → shorten a URL → follow the short link
```

**On camera:** shorten a real URL, follow the redirect, then say out loud: "Notice the terminal. Nothing. The app just did four things — a form load, an API call, a database write, a redirect — and left no trace anywhere. Remember this moment."

---

### Slide 10 — Repo and branch convention

**On screen:** `github.com/JonathanScion/jonathan-code` → `observability-on-aws/` subdirectory. Branch list: `episode-00-setup`, `episode-01-start`, `episode-02-start` …

**Voiceover:**
The course repo lives in a subdirectory called observability-on-aws inside my jonathan-code repository — link in the description. Every episode has a start branch: check out episode-two-start and you're in exactly the state episode two begins from, no matter what you did or didn't do in earlier episodes. Commit your own work on your own branches; use mine as save points.

**DEMO — PRESCRIPTIVE (git):** `episode-00-demo-commands.sh`, section 5.

---

### Slide 11 — Teardown philosophy

**On screen:** The rule in large type: "Nothing survives the session." Below: the three billers — ALB ~$16/mo, NAT ~$32/mo, EKS control plane ~$73/mo.

**Voiceover:**
Last thing, and it matters more than anything else in this episode. Every AWS session in this course ends by running that episode's teardown script. The three resources that will quietly bill you are load balancers, NAT gateways, and — later in the course — the EKS control plane, which is seventy-three dollars a month whether you use it or not. The discipline is simple: nothing survives the session. Create at the start, destroy at the end, and your budget alarm never fires.

---

### Slide 12 — Outro

**On screen:** Episode 1 title card preview. jonathanscode.io, subscribe prompt.

**Voiceover:**
That's setup. You have a safe account, a working CLI, and a deliberately silent app. In Episode One we talk about what observability actually is — the three pillars, the three layers, and the grid that turns them into a diagnostic method. If this was useful, subscribe for the rest of the series — and for more courses and my consulting work, visit jonathanscode dot io. See you in the next one.

---

## Recording notes

- **Console segments:** record at 1920×1080, browser at 100% zoom, hide bookmarks bar. Blur account ID (top-right) in Camtasia with a tracked blur region.
- **Terminal segments:** font size 18+, dark theme matching the slides (#0D1117 background if your terminal supports it). Clear scrollback before each take.
- **Re-shoot triggers:** access key visible on screen; account ID unblurred; AWS console UI differing from narration (AWS moves things — narrate resiliently: "search for Budgets" not "click the third menu item").
- **The Slide 9 'silence' beat** is the emotional anchor of the episode — leave 2 seconds of dead air on the empty terminal before the line.

## Post-production

- Chapters: 0:00 Intro · 1:10 What we're building · 2:20 AWS account & IAM · 4:30 Budget alarm · 5:30 AWS CLI · 7:10 Toolchain · 8:00 The app · 10:30 Repo · 11:20 Teardown · 12:30 Outro
- Thumbnail frame: the Slide 11 "Nothing survives the session" card.
- Description: link repo subdirectory, link Episode 1, cost disclaimer, jonathanscode.io.
