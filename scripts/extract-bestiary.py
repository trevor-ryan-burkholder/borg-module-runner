"""Extract a bestiary JSON from wiki/creatures/*.md.

Output schema:
    {
      "source": "...",
      "entries": [
        { "id": "...", "name": "...", "descriptor": "...",
          "source": "...", "hp": "...", "morale": "...",
          "attack": "...", "special": "...", "lore": "..." },
        ...
      ]
    }

Pragmatic, lossy. Reviewed by hand; obvious misses get fixed in JSON.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CREATURES = ROOT / "wiki" / "creatures"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "bestiary.json"


def slugify(name: str) -> str:
    s = re.sub(r"\(.*?\)", "", name).strip()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "unknown"


def first(rx, text, group=1, flags=0, default=""):
    m = re.search(rx, text, flags)
    return m.group(group).strip() if m else default


def parse_creature(md: str, filename: str) -> dict:
    lines = md.splitlines()
    # First H1 line.
    name_line = next((l for l in lines if l.startswith("# ")), "").lstrip("# ").strip()
    # Remove any parenthetical variant for display name; keep it in raw.
    display_name = re.sub(r"\s*\(.*?\)\s*$", "", name_line).strip()
    # Italic descriptor — first *...* on its own.
    descriptor = first(r"^\*([^*]+)\*\s*$", md, flags=re.MULTILINE)
    source = first(r"\*\*Source:\*\*\s*(.+)$", md, flags=re.MULTILINE)
    # Stat line: starts with HP, comma-separated.
    stat_line = first(r"^HP[^\n]+", md, group=0, flags=re.MULTILINE)
    hp = first(r"HP[\s:]*([0-9\-d+\s]+?)(?:,|$)", stat_line)
    morale = first(r"Morale[\s:]*([^,\n]+)", stat_line)
    # Attack: everything after "Morale ...," or extract the last weapon-y bit.
    # Fallback: take stat_line minus the HP and Morale fragments.
    attack = ""
    if stat_line:
        bits = [b.strip() for b in stat_line.split(",")]
        # Drop the HP and Morale bits.
        rest = [b for b in bits if not b.lower().startswith("hp") and not b.lower().startswith("morale")]
        attack = ", ".join(rest)
    special = first(r"\*\*Special:\*\*\s*(.+?)(?:\n\n|\Z)", md, flags=re.DOTALL)
    # Lore: first paragraph after the stat block that isn't a metadata line.
    lore = ""
    # Strip frontmatter-ish header up to the stat line, then take the first
    # plain paragraph that doesn't start with ** or HP.
    after_stats = md.split(stat_line, 1)[-1] if stat_line else md
    for para in re.split(r"\n\s*\n", after_stats):
        p = para.strip()
        if not p:
            continue
        if p.startswith("**") or p.startswith("HP") or p.startswith("*"):
            continue
        # Skip the special block — we already captured it.
        if p.lower().startswith("special:"):
            continue
        lore = re.sub(r"\s+", " ", p).strip()
        break

    return {
        "id": slugify(display_name or filename),
        "name": display_name or filename,
        "descriptor": descriptor,
        "source": source,
        "hp": hp,
        "morale": morale,
        "attack": attack,
        "special": special,
        "lore": lore,
    }


def main():
    entries = []
    for md_path in sorted(CREATURES.glob("*.md")):
        if md_path.name == "README.md":
            continue
        text = md_path.read_text(encoding="utf-8")
        entry = parse_creature(text, md_path.stem)
        entries.append(entry)
    out = {
        "source": "Extracted from wiki/creatures/*.md (Mörk Borg core + supplements).",
        "count": len(entries),
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} entries → {OUT}")


if __name__ == "__main__":
    main()
