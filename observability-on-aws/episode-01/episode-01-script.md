# Episode 1 — What Observability Actually Is

**Course:** Observability on AWS: From Console.log to On-Call
**Episode type:** Public — the course opener; has to earn the subscribe
**Target length:** 15–17 minutes
**Repo branch:** `episode-01-start` (identical to end of Episode 0)
**Artifacts in this folder:** this script (md + docx), slides (pptx), voiceover text (txt), audio generator (js), demo commands (sh)

---

## Learning objectives

By the end of this episode, a viewer can:

1. Define **telemetry** and **taxonomy** and use both words correctly in an interview.
2. Name the **three pillars of observability** — logs, metrics, traces — and state what question each answers.
3. Name the **three layers** that emit telemetry — application, platform, infrastructure — and give an AWS example of each.
4. Combine them into the **3×3 grid** and place any signal (e.g., `console.log`, VPC Flow Logs, ECS events) in its cell.
5. Explain **monitoring vs observability** (known-unknowns vs unknown-unknowns).
6. State precisely where `console.log` sits: one source inside one cell of one pillar.

**Not in this episode (and said out loud):** which signal to check *first* — that's Episode 6, The Diagnostic Compass. Episode 1 builds the map; Episode 6 teaches navigation.

---

## Slide-by-slide script

---

### Slide 1 — Title

**On screen:** Course title, "Episode 1 — What Observability Actually Is", jonathanscode.io footer.

**Voiceover:**
This is Observability on AWS, Episode One: what observability actually is. Not the vendor-pitch version, not the buzzword version — the version that gets you through a production incident at two in the morning, and through the interview question about one.

---

### Slide 2 — The 2 AM scenario (hook)

**On screen:** Dark slide, single quote styled as an interview question: "You push to prod. Nothing responds. The services have no logging. What do you do?"

**Voiceover:**
Let me start with a real interview question — one that gets asked, in some form, in almost every senior engineering interview. You push your environment to production. Nothing works. Services don't respond. And here's the twist the interviewer adds: the services have no logging. Nobody wrote a single log line. What do you do? If your honest answer is "I'm stuck without logs" — this course exists for you. Because by the end of this episode you'll know why that scenario is nowhere near as blind as it sounds, and by the end of the course you'll be able to narrate the fix step by step.

---

### Slide 3 — Telemetry

**On screen:** Word card: **telemetry** — *tele* (far) + *metron* (measure). "Data your systems emit about themselves so you can observe them from outside." Icons: rocket → mission control.

**Voiceover:**
Two words first, because precision wins interviews. Telemetry. Literally: measurement at a distance — sensors on a rocket beaming data back to mission control. In software, telemetry is every piece of data your system emits about itself so you can observe it from the outside. Log lines are telemetry. CPU numbers are telemetry. Request traces are telemetry. When you hear "OpenTelemetry" — the industry standard we'll use later in the course — this is the telemetry it's talking about.

---

### Slide 4 — Taxonomy

**On screen:** Word card: **taxonomy** — "a classification system; the buckets we sort things into." Small biology tree (kingdom → species) fading into logs/metrics/traces buckets.

**Voiceover:**
Second word: taxonomy. A taxonomy is just a classification system — named buckets we sort things into. Biology sorts life into kingdoms and species; observability sorts telemetry into a small set of signal types. Why does the word matter? Because the famous "three pillars" you're about to meet are exactly that — a taxonomy. They tell you what kinds of signals exist. They do not tell you which one to check first in an incident. Keeping those two ideas separate is what this course is built on.

---

### Slide 5 — Pillar one: logs

**On screen:** Pillar card, teal accent. **LOGS** — discrete events with context. Example line: `{"level":"error","msg":"payment failed","userId":123,"at":"14:32:07"}`. Question answered: **"What exactly happened?"**

**Voiceover:**
Pillar one: logs. A log is a discrete event — something happened, at a moment in time, with context attached. User one-two-three's payment failed at fourteen thirty-two. Logs are the richest signal in detail and the heaviest in volume. Their superpower: once you know roughly where to look, a log tells you exactly what happened. Their weakness: a production system emits gigabytes of them, and "somewhere in the logs" is a very big haystack. Logs answer the question: what exactly happened?

---

### Slide 6 — Pillar two: metrics

**On screen:** Pillar card. **METRICS** — numbers over time. Mini line-chart motif. Examples: request rate, error %, p99 latency, CPU. Question answered: **"Is something wrong, and how wrong?"**

**Voiceover:**
Pillar two: metrics. A metric is a number tracked over time. Requests per second. Error percentage. Ninety-ninth percentile latency. CPU. Metrics are cheap, pre-aggregated, and always on — which makes them the fastest signal to read at a glance. One dashboard tile can tell you in five seconds that something is wrong and how wrong. What metrics can't usually tell you is why. And a spoiler for the interview story from slide two: the word the interviewer was hinting at — metrics. Even when nobody wrote a single log line, the platform is emitting metrics about your services the entire time. Hold that thought; it becomes Episode Three.

---

### Slide 7 — Pillar three: traces

**On screen:** Pillar card. **TRACES** — one request's journey across services. Waterfall diagram motif: API → auth → db (slow span highlighted amber). Question answered: **"Where in the path did it break?"**

**Voiceover:**
Pillar three: traces. A trace follows one single request as it travels through your system — through the load balancer, into service A, which calls service B, which queries the database. Each step is a span with its own timing, and together they form a waterfall. When something is slow or failing somewhere in a chain of services, the trace points at the exact hop. Traces answer: where in the request path did it break? In a system with one service they're a luxury. In a system with twelve, they're the difference between minutes and days.

---

### Slide 8 — The pillars are a map, not a route

**On screen:** The three pillars side by side with their three questions. Banner: "A taxonomy of signals — NOT a checking order."

**Voiceover:**
Here's the mistake almost everyone makes, and it's worth naming now. Logs, metrics, traces is not a sequence. It's not "check logs first, then metrics, then traces." It's a taxonomy — remember slide four — a map of what signal types exist and what question each answers. Which one you reach for first depends entirely on which question you're asking. There's a whole episode later in this course — I call it the Diagnostic Compass — devoted to exactly that decision. For now, just internalize the three questions: what happened, how bad is it, and where in the path.

---

### Slide 9 — The three layers

**On screen:** Three horizontal strata. **Application** — your code (structured logs, custom metrics, instrumented traces). **Platform** — the runtime (ECS/EKS events, container restarts, health checks). **Infrastructure** — the substrate (ALB metrics, VPC Flow Logs, DNS, security groups).

**Voiceover:**
Now the second axis, the one that unlocks the interview question. Signals don't just come in three types — they come from three layers of the stack. The application layer: telemetry your own code emits. Your log lines, your custom metrics, your instrumented traces. The platform layer: what the runtime gives you for free — ECS or Kubernetes reporting zero of three tasks running, container restarts, failed health checks. And the infrastructure layer: the substrate underneath — load balancer metrics, VPC flow logs, DNS, security groups. Here's the key: only the first layer requires you to have written anything. The other two are emitting telemetry right now, whether your code logs or not.

---

### Slide 10 — The 3×3 grid

**On screen:** The full grid. Rows: Application / Platform / Infrastructure. Columns: Logs / Metrics / Traces. Filled cells, e.g. App×Logs = `console.log`, structured logs · Platform×Metrics = task count, restarts · Infra×Logs = VPC Flow Logs, ALB access logs · Infra×Metrics = ALB 5xx, healthy hosts.

**Voiceover:**
Put the two axes together and you get the mental model for the entire course: a three-by-three grid. Three signal types across, three emitting layers down, nine cells. Every observability signal you will ever meet lives in exactly one cell. Your console dot log? Application row, logs column. VPC flow logs? Infrastructure row, logs column. The count of running ECS tasks? Platform row, metrics column. And now re-read the interview question: "the services have no logging" empties exactly one cell — application-logs. Eight cells still full. The scenario that sounded like flying blind is actually a system still broadcasting on eight channels. The rest of this course is learning to read all nine.

---

### Slide 11 — Where console.log fits

**On screen:** Nesting diagram: `console.log` ⊂ application logs ⊂ the logs pillar ⊂ the three pillars. Each ring labeled.

**Voiceover:**
Let's zoom into the cell most developers live in, because there's a subtlety interviewers probe. Console dot log is not "the logs pillar." It's one source, inside application logs, inside the logs pillar, inside the three pillars. A small piece of a small piece of a third of the picture. When it disappears — like in our interview scenario — you've lost maybe ten or fifteen percent of your observability surface, not a hundred. If you take one sentence from this episode into an interview, take that one.

---

### Slide 12 — Monitoring vs observability

**On screen:** Two columns. **Monitoring:** dashboards and alerts for failures you predicted — known-unknowns. **Observability:** the ability to ask new questions of a system about failures you never predicted — unknown-unknowns.

**Voiceover:**
One more distinction, because it's a classic interview question on its own. Monitoring versus observability. Monitoring is watching for the failures you predicted — you knew disk space could fill, so you built a dashboard and an alert. Known-unknowns. Observability is a property of the system: how well can you ask it questions you never thought to ask in advance? When production breaks in a way nobody imagined — and it always eventually does — monitoring shrugs, and observability is what lets you interrogate the system until it confesses. Rich telemetry across all nine cells of that grid is what makes a system observable.

---

### Slide 13 — The five failures this course will diagnose

**On screen:** Five numbered cards, each tagged with the cell/signal that will crack it: 1. Business-logic bug → App×Logs (Ep 2–3) · 2. Someone changed IAM and broke prod → CloudTrail (Ep 4) · 3. One endpoint got slow → Traces (Ep 5) · 4. Deploy goes out, nothing responds → Platform×Metrics + events (Ep 7–8) · 5. A failure you haven't seen → full triage, live (Ep 10, and with AI in Ep 12).

**Voiceover:**
Here's the road ahead — five production failures, staged deliberately, each diagnosed on camera with the signal built for it. A business-logic bug that only application logs can see. A permissions change that silently breaks production — cracked in thirty seconds with an audit trail most developers have never opened. A latency spike that logs and metrics both shrug at, until a trace points at the exact span. The full interview scenario — a deploy that leaves nothing responding and no logs to read. And finally a failure you haven't seen before, triaged live, start to finish — once by me, and once, at the end of the course, by an AI agent, so you can see exactly where those help and where they fall over.

---

### Slide 14 — Outro

**On screen:** Episode 2 preview card: "Application Logs — Where Most Devs Start". jonathanscode.io, subscribe prompt.

**Voiceover:**
That's the map: three pillars, three layers, nine cells, and one interview question that already looks less scary. Next episode we start filling the grid where most developers start — application logs — and we give our deliberately silent app its voice, properly: structured, leveled, and correlated. If this was useful, subscribe for the rest of the series — and for more courses and my consulting work, visit jonathanscode dot io. See you in the next one.

---

## Demo notes

Episode 1 is intentionally slide-heavy. Optional 60-second live beat after Slide 2:

**DEMO — PRESCRIPTIVE:** `episode-01-demo-commands.sh` — start the app (`STORAGE=memory npm run dev`), shorten one URL, then kill the process. On camera: "Four operations just happened. The terminal shows nothing. Right now, this app's grid is nine empty cells. Keep that image."

## Recording notes

- Slide-driven episode: record voiceover per slide from the generated mp3s, then screen-capture the deck advancing in Camtasia; sync on slide boundaries.
- Slides 5–7 (the pillars) share a visual template — advance rhythm should feel identical across the three, ~55–65s each.
- Slide 10 (the grid) is the thumbnail candidate and the frame viewers will screenshot — leave it on screen a beat longer than feels natural.
- The Slide 6 metrics reveal ("the word the interviewer was hinting at") is the payoff of the cold open — slight pause before "metrics."

## Post-production

- Chapters: 0:00 The 2 AM question · 1:30 Telemetry · 2:30 Taxonomy · 3:30 Logs · 4:30 Metrics · 5:30 Traces · 6:30 A map, not a route · 7:30 The three layers · 9:00 The 3×3 grid · 10:45 Where console.log fits · 11:45 Monitoring vs observability · 13:00 Five failures ahead · 14:30 Outro
- Description: link Episode 0 (setup), starter repo branch `episode-01-start`, jonathanscode.io.
