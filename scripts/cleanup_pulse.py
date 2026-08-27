from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")

# Remove only empty runtime placeholders. Never touch a block that contains
# implementation code. Repeating the substitution makes cleanup deterministic
# even when several placeholders are adjacent.
patterns = [
    r'<script\s+id=["\']pulse-history-runtime["\']\s*>\s*</script>',
    r'<script\s+id=["\']pulse-custom-answer-runtime["\']\s*>\s*</script>',
]

for pattern in patterns:
    previous = None
    while previous != text:
        previous = text
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

path.write_text(text, encoding="utf-8")
