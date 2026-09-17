#!/usr/bin/env bash
# Episode 1 — demo commands.
# Episode 1 is slide-driven; this is the single optional live beat
# placed right after Slide 2 (the interview-question hook).
set -euo pipefail

############################################################
# THE 60-SECOND SILENCE BEAT
# Purpose: show the app doing real work while emitting nothing.
############################################################
cd app                       # the Episode 0 app
clear                        # clean terminal for the shot
STORAGE=memory npm run dev &
APP_PID=$!
sleep 2

# In the browser (on camera): http://localhost:3000
#   1. shorten https://jonathanscode.io
#   2. open the short link — it redirects
# Or from a second terminal, if you prefer staying in the shell:
curl -s -X POST localhost:3000/shorten \
  -H 'content-type: application/json' \
  -d '{"url":"https://jonathanscode.io"}'
# → {"code":"Ab3dEf"}   (code will differ)
curl -s -o /dev/null -w "%{http_code} → %{redirect_url}\n" localhost:3000/Ab3dEf

# CAMERA: cut back to the app terminal. It shows NOTHING.
# LINE (from the script): "Four operations just happened. The terminal
# shows nothing. Right now, this app's grid is nine empty cells."

kill $APP_PID
