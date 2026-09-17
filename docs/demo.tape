# kilo-ai-cli TUI demo — scripted key sequence for docs/demo.gif
#
# The committed GIF was produced with tmux + asciinema + agg against the
# real API (VHS produced no frames in our headless environment):
#
#   tmux new-session -d -s demo -x 150 -y 45
#   asciinema rec demo.cast --window-size 150x45 -c "tmux attach -t demo" &
#   tmux send-keys -t demo ...   # the sequence below
#   agg demo.cast docs/demo.gif --speed 1.2 --idle-time-limit 4 --font-size 16
#
# This tape mirrors the same flow for VHS users: vhs docs/demo.tape
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

# Sessions (sidebar item 1) — real session table
Down
Sleep 500ms
Enter
Sleep 3s
Down
Down
Down
Sleep 1s
Escape
Sleep 1s

# Navigate to Security → Findings (sidebar item 8, i.e. 7 more down)
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

# Repo picker (R) — pick a monitored repository
Type "R"
Sleep 3s
Down
Down
Down
Sleep 500ms
Escape
Sleep 500ms

# Severity filter picker (f)
Type "f"
Sleep 2s
Escape
Sleep 500ms

# Sort picker (o) — switch to severity ascending
Type "o"
Sleep 2s
Down
Enter
Sleep 3s

# Column picker (c) — toggle the id column on
Type "c"
Sleep 2s
Down
Down
Down
Down
Down
Space
Enter
Sleep 3s

# Back to sidebar, then quit
Escape
Sleep 1s
Type "q"
Sleep 1s
