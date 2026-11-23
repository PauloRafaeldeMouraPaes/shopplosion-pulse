"""Category pilots, Python side. Same registry and files as scripts/lib/pilot-config.js: pilots.json lists the
configuration of each pilot; the scripts take the pilot as a parameter and name no category."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def load_pilots(root=ROOT):
    registry = json.loads((root / "pilots.json").read_text(encoding="utf-8"))
    pilots = []
    for rel in registry.get("pilots", []):
        p = json.loads((root / rel).read_text(encoding="utf-8"))
        p["config_path"] = rel
        for field in ("key", "label", "kit", "nfce"):
            if not p.get(field):
                raise ValueError(f"{rel}: missing {field}")
        for field in ("terms_file", "keep_pattern", "drop_pattern"):
            if not p["nfce"].get(field):
                raise ValueError(f"{rel}: missing nfce.{field}")
        pilots.append(p)
    keys = [p["key"] for p in pilots]
    if len(set(keys)) != len(keys):
        raise ValueError("pilots.json: duplicate pilot")
    return pilots


def get_pilot(key=None, root=ROOT):
    """The pilot named by key; with a single registered pilot the key may be left out."""
    pilots = load_pilots(root)
    if not key:
        if len(pilots) == 1:
            return pilots[0]
        raise ValueError("--pilot <key> is required; registered: " + ", ".join(p["key"] for p in pilots))
    for p in pilots:
        if p["key"] == key:
            return p
    raise ValueError(f"unknown pilot {key}; registered: " + ", ".join(p["key"] for p in pilots))


def classifier(pilot):
    """The description filter of the pilot: kept when keep_pattern matches and drop_pattern does not."""
    keep = re.compile(pilot["nfce"]["keep_pattern"], re.I)
    drop = re.compile(pilot["nfce"]["drop_pattern"], re.I)
    return lambda desc: bool(keep.search(desc)) and not drop.search(desc)
