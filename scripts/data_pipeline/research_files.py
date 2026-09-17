"""Load relocated research evidence without rewriting frozen files on disk."""
import json
from pathlib import Path

MIGRATION = json.loads(
    (Path(__file__).resolve().parents[2] / "docs/research/path-migration.json").read_text(encoding="utf-8")
)


def parse_research_json(text):
    def relocate(value):
        if isinstance(value, str):
            return MIGRATION["paths"].get(value, MIGRATION["sourceRevisions"].get(value, value))
        if isinstance(value, list):
            return [relocate(entry) for entry in value]
        if isinstance(value, dict):
            return {MIGRATION["paths"].get(key, key): relocate(entry) for key, entry in value.items()}
        return value

    return relocate(json.loads(text))