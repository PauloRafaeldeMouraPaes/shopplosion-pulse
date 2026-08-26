from pathlib import Path
import re
import sys

if len(sys.argv) < 2:
    print("Uso: python extract_inline_js.py index.html [output_dir]")
    sys.exit(1)

html_path = Path(sys.argv[1])
output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/tmp/pulse-js")

if not html_path.exists():
    print(f"Arquivo não encontrado: {html_path}")
    sys.exit(1)

html = html_path.read_text(encoding="utf-8")

scripts = re.findall(
    r"<script\b[^>]*>(.*?)</script\s*>",
    html,
    flags=re.IGNORECASE | re.DOTALL,
)

output_dir.mkdir(parents=True, exist_ok=True)

count = 0

for index, content in enumerate(scripts, start=1):
    stripped = content.strip()

    if not stripped:
        continue

    output_file = output_dir / f"script-{index}.js"
    output_file.write_text(stripped + "\n", encoding="utf-8")
    count += 1

print(f"Extraídos {count} blocos JavaScript.")
