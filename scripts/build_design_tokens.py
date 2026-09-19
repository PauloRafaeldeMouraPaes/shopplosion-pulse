#!/usr/bin/env python3
"""
Gera pulse-tokens.css a partir de design/tokens.json.

Este script é o lado "produtor" da sincronização com o Design System Pulse
(artifact claude.ai/artifact/HJpqAb7H3fQ9qu5bEcmpn3). Sempre que o design
system for atualizado, exporte o tokens.json dele, substitua
design/tokens.json por essa versão e rode:

    python3 scripts/build_design_tokens.py

Isso regenera pulse-tokens.css (variáveis CSS + classes de tipografia) na
raiz do repositório. Nada aqui inventa valor: cada variável vem direto de
design/tokens.json, na mesma forma que o design system usa.

Um workflow de CI (.github/workflows/design-tokens.yml) roda este mesmo
comando sempre que design/tokens.json muda e falha o build se
pulse-tokens.css sair diferente do que está commitado — ou seja, o CSS
gerado nunca fica dessincronizado do token source por muito tempo.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS_PATH = ROOT / "design" / "tokens.json"
OUT_PATH = ROOT / "pulse-tokens.css"


def esc_name(name: str) -> str:
    return name.replace(".", "\\.")


def color_block(tokens: dict) -> str:
    themes = tokens.get("color", {}).get("themes", [])
    color_tokens = tokens.get("color", {}).get("tokens", [])
    if not themes or not color_tokens:
        return ""
    first = themes[0]["id"]
    lines = []
    lines.append(f':root, [data-theme="{first}"] {{')
    for t in color_tokens:
        value = t["value"]
        v = value if isinstance(value, str) else value.get(first, "")
        lines.append(f"  --{esc_name(t['name'])}: {v}; /* {t.get('usage','')} */")
    for st in tokens.get("shadow", {}).get("tokens", []):
        value = st["value"]
        v = value if isinstance(value, str) else value.get(first, "")
        lines.append(f"  --{esc_name(st['name'])}: {v}; /* {st.get('usage','')} */")
    lines.append("}")
    for theme in themes[1:]:
        tid = theme["id"]
        lines.append(f'[data-theme="{tid}"] {{')
        for t in color_tokens:
            value = t["value"]
            if isinstance(value, dict) and tid in value:
                lines.append(f"  --{esc_name(t['name'])}: {value[tid]};")
        lines.append("}")
    return "\n".join(lines)


def root_scalars_block(tokens: dict) -> str:
    lines = [":root {"]
    for fam in ("spacing", "radius", "breakpoint"):
        for t in tokens.get(fam, {}).get("tokens", []):
            lines.append(f"  --{esc_name(t['name'])}: {t['value']}; /* {t.get('usage','')} */")
    families = tokens.get("type", {}).get("families", {})
    for key, stack in families.items():
        lines.append(f"  --font-{esc_name(key)}: {stack};")
    lines.append("}")
    return "\n".join(lines)


def type_classes_block(tokens: dict) -> str:
    families = tokens.get("type", {}).get("families", {})
    groups = tokens.get("type", {}).get("groups", [])
    lines = []
    for g in groups:
        family_key = g.get("family")
        for style in g.get("styles", []):
            name = style["name"]
            decls = [f"  font-family: var(--font-{family_key});"]
            if "fontSize" in style:
                decls.append(f"  font-size: {style['fontSize']};")
            if "lineHeight" in style:
                decls.append(f"  line-height: {style['lineHeight']};")
            if "letterSpacing" in style:
                decls.append(f"  letter-spacing: {style['letterSpacing']};")
            if "fontWeight" in style:
                decls.append(f"  font-weight: {style['fontWeight']};")
            lines.append(f".{name} {{ /* {style.get('usage','')} */")
            lines.extend(decls)
            lines.append("}")
    return "\n".join(lines)


def main() -> int:
    if not TOKENS_PATH.exists():
        print(f"Não encontrei {TOKENS_PATH}", file=sys.stderr)
        return 1
    tokens = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))

    header = (
        "/* GERADO por scripts/build_design_tokens.py a partir de design/tokens.json. */\n"
        "/* Não edite à mão — edite design/tokens.json (ou o Design System Pulse) e rode o script de novo. */\n"
        f"/* Fonte: {tokens.get('meta', {}).get('repo', '')}"
        f"@{tokens.get('meta', {}).get('ref', '')}"
        f", sincronizado em {tokens.get('meta', {}).get('synced', '')} */\n"
    )

    css = "\n\n".join(
        part for part in (
            header.strip(),
            color_block(tokens),
            root_scalars_block(tokens),
            type_classes_block(tokens),
        ) if part
    )
    OUT_PATH.write_text(css + "\n", encoding="utf-8")
    print(f"Escrevi {OUT_PATH} a partir de {TOKENS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
