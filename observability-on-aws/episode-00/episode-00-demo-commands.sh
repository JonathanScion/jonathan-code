#!/usr/bin/env bash
# Episode 0 — demo commands, in recording order.
# This file is a REFERENCE for copy-pasting sections live on camera.
# Do NOT run it top-to-bottom blindly; sections are independent.
set -euo pipefail

############################################################
# SECTION 1 — AWS CLI v2 install (Linux / WSL)
# (Mac: `brew install awscli` · Windows-native: use the MSI)
############################################################
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip -q awscliv2.zip
sudo ./aws/install
aws --version    # expect aws-cli/2.x

############################################################
# SECTION 2 — Configure the named profile
# PRE-REQ (console): IAM → Users → course-admin → Security credentials
#                    → Create access key → CLI use case → copy both values
# ON CAMERA: pause recording before pasting the secret.
############################################################
aws configure --profile course
#   AWS Access Key ID:     <paste>
#   AWS Secret Access Key: <paste>
#   Default region name:   us-east-1
#   Default output format: json

export AWS_PROFILE=course

# Identity check — MUST show the course-admin user ARN, never root:
aws sts get-caller-identity

############################################################
# SECTION 3 — Toolchain check (Node + Terraform)
############################################################
node --version    # need >= 20
npm --version     # need >= 10
npx tsc --version || npm install -g typescript
git --version

# Terraform >= 1.9 — the course-standard IaC tool from Episode 3 on.
# Linux/WSL install (HashiCorp apt repo):
wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y terraform
terraform -version   # need >= 1.9

############################################################
# SECTION 4 — Scaffold + run the app (after the AI-build step)
# The app itself is built DIRECTIONALLY with your AI assistant
# (prompt in the episode script, Slide 9). These commands assume
# it exists in ./app with the agreed package.json scripts.
############################################################
cd app
npm install
STORAGE=memory npm run dev
# → browser: http://localhost:3000
# → shorten a URL, follow the short link
# → point at the terminal: ZERO output. That's the whole point.
# Ctrl+C to stop.

############################################################
# SECTION 5 — Repo setup (adjust remote to your fork if following along)
############################################################
cd ..
git init -b main 2>/dev/null || true
cat > .gitignore <<'EOF'
node_modules/
dist/
.env
audio/
*.mp3
EOF
git add .
git commit -m "Episode 0: silent URL shortener + toolchain setup"
# Course viewers: fork/clone instead —
#   git clone https://github.com/JonathanScion/jonathan-code
#   cd jonathan-code/observability-on-aws
#   git checkout episode-01-start

############################################################
# SECTION 6 — Teardown (Episode 0 creates NO AWS resources
# beyond the free IAM user + budget, so nothing to destroy.
# This section exists to establish the ritual on camera.)
############################################################
echo "Nothing billable was created in Episode 0."
echo "The ritual stands: every future episode ends with ./teardown.sh"
