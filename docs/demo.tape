# kilo-ai-cli TUI demo — key sequence used for docs/demo.gif
#
# The committed GIF was produced with tmux + asciinema + agg, driven by
# `tmux send-keys`. Security-agent endpoints were stubbed by
# packages/cli/scripts/demo-api-stub.ts (passthrough proxy + fixture
# findings) so the demo shows populated data without mutating a real
# account. To regenerate:
#
#   node packages/cli/scripts/demo-api-stub.ts &          # :8399
#   tmux new-session -d -s demo -x 150 -y 45
#   tmux send-keys -t demo 'export KILO_API_URL=http://localhost:8399' Enter
#   asciinema rec demo.cast --window-size 150x45 -c "tmux attach -t demo" &
#   tmux send-keys -t demo ...                            # the sequence below
#   agg demo.cast docs/demo.gif --speed 1.2 --idle-time-limit 4 --font-size 16
#
# Redact account PII in the cast before rendering (email, org UUID, name).
# VHS users can replay the same keys below: vhs docs/demo.tape

Output docs/demo.gif
Set Shell bash
Set FontSize 15
Set Width 1500
Set Height 900
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set PlaybackSpeed 1.2

# Launch the TUI
Type "npx kilo-ai-cli tui"
Enter
Sleep 6s

# Sessions (sidebar item 1) — live session table
Down
Sleep 500ms
Enter
Sleep 3s
Down
Down
Sleep 1s
Escape
Sleep 1s

# Security → Findings (sidebar item 8 = 7 more down)
Down
Down
Down
Down
Down
Down
Down
Sleep 500ms
Enter
Sleep 4s

# Browse the populated table
Down
Down
Sleep 800ms

# Repo picker (R) — scope to one repository
Type "R"
Sleep 2500ms
Down
Down
Enter
Sleep 2500ms

# Severity filter (f) — pick `high`
Type "f"
Sleep 2s
Down
Down
Enter
Sleep 2500ms

# Clear severity filter → (all severities)
Type "f"
Sleep 1500ms
Enter
Sleep 2s

# Clear repo filter → (all repositories)
Type "R"
Sleep 1500ms
Enter
Sleep 2s

# Sort picker (o) — switch to severity ascending
Type "o"
Sleep 2s
Down
Enter
Sleep 2500ms

# Column picker (c) — enable the id column
Type "c"
Sleep 2s
Down
Down
Down
Down
Down
Space
Sleep 700ms
Enter
Sleep 2500ms

# Open finding detail (CVE / GHSA / CVSS card)
Enter
Sleep 3500ms
Escape
Sleep 1200ms

# Back to sidebar
Escape
Sleep 1200ms

# Security → Stats (item 10, 2 down from Findings)
Down
Down
Sleep 500ms
Enter
Sleep 3500ms
Escape
Sleep 1s

# Security → Dashboard (item 11)
Down
Sleep 500ms
Enter
Sleep 3500ms
Escape
Sleep 1s

# Quit
Type "q"
Sleep 1s
