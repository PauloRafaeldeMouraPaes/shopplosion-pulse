from pathlib import Path
import re
import sys

INDEX = Path("index.html")
errors = []
observations = []

if not INDEX.exists():
    errors.append("BLOCKER: index.html não encontrado.")
else:
    text = INDEX.read_text(encoding="utf-8")

    # Permanent single-file contract.
    if Path("assets").exists():
        errors.append("BLOCKER: a pasta assets/ existe no repositório.")

    if re.search(r"(?:src|href)\s*=\s*[\"'](?:assets/|\.?/?assets/)", text, re.I):
        errors.append("BLOCKER: referência local a assets/ encontrada em index.html.")

    # Catch accidental local dependencies while allowing fragment/data URLs.
    attrs = re.findall(r"(?:src|href)\s*=\s*[\"']([^\"']+)[\"']", text, re.I)
    for value in attrs:
        if value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
            continue
        if value.startswith(("./", "../", "/")) or not re.match(r"^[a-z][a-z0-9+.-]*:", value, re.I):
            # Relative paths are only valid if the single-file contract explicitly permits them.
            errors.append(f"BLOCKER: dependência/referência local encontrada: {value}")

    # Obvious development leftovers.
    suspicious = [
        (r"localhost(?::\d+)?", "referência a localhost"),
        (r"127\.0\.0\.1(?::\d+)?", "referência a 127.0.0.1"),
        (r"TODO|FIXME|XXX", "marcador de implementação pendente"),
    ]
    for pattern, label in suspicious:
        if re.search(pattern, text, re.I):
            observations.append(label)

    if not re.search(r"<!doctype html>", text, re.I):
        errors.append("BLOCKER: DOCTYPE HTML ausente.")
    if not re.search(r"<html\b", text, re.I):
        errors.append("BLOCKER: elemento <html> ausente.")
    if not re.search(r"<meta[^>]+name=[\"']viewport[\"']", text, re.I):
        observations.append("meta viewport não detectada")

if errors:
    print("ADVERSARIAL REVIEW: FAILED")
    for item in errors:
        print(f"- {item}")
    if observations:
        print("Observations:")
        for item in observations:
            print(f"- {item}")
    sys.exit(1)

print("ADVERSARIAL REVIEW: PASSED")
if observations:
    print("Observations:")
    for item in observations:
        print(f"- {item}")
