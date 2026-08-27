from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")

# Remove only empty duplicate runtime placeholders. Keep any non-empty
# implementation blocks intact. This makes the generated single-file artifact
# deterministic without changing application logic.
patterns = [
    r'\n?<script id="pulse-history-runtime">\s*</script>\n?',
    r'\n?<script id="pulse-custom-answer-runtime">\s*</script>\n?',
]

for pattern in patterns:
    text = re.sub(pattern, "\n", text)

path.write_text(text, encoding="utf-8")
