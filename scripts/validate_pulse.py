from pathlib import Path
import re
import sys

root = Path(".")
index = root / "index.html"
errors = []

if not index.exists():
    errors.append("index.html não encontrado.")

if (root / "assets").exists():
    errors.append("A pasta assets/ não deve existir no artefato final.")

if index.exists():
    text = index.read_text(encoding="utf-8")

    if not re.search(r"<!doctype html>", text, re.I):
        errors.append("DOCTYPE HTML não encontrado.")

    if not re.search(r"<html\b", text, re.I):
        errors.append("Elemento <html> não encontrado.")

    if re.search(
        r"""(?:src|href)\s*=\s*["'](?:assets/|\.?/?assets/)[^"']*["']""",
        text,
        re.I,
    ):
        errors.append("Foi encontrada referência a assets/.")

if errors:
    print("VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("VALIDATION PASSED")
