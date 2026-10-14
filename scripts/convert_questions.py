#!/usr/bin/env python3
"""
Converts an old-style questions file to the v2 format (docs/QUESTION_FORMAT.md).

Each question gets an explicit "id". If it didn't have one, the ID is the
same MD5-of-the-text the kiosk always used, so answer history stays linked.

Usage:
    python scripts/convert_questions.py data/questions.json             (converts in place)
    python scripts/convert_questions.py old.json new.json               (writes a new file)
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from server.services.question_bank import load_question_file, clean_question


def convert(src, dest):
    _, raw_questions = load_question_file(src)
    out, problems = [], []

    for i, raw in enumerate(raw_questions):
        q, err = clean_question(raw)
        if err:
            problems.append(f"#{i + 1}: {err}")
            continue
        item = {
            'id': q['id'],
            'question': q['question'],
            'answers': q['answers'],
            'correct': q['correct'],
            'tags': q['tags'],
        }
        for key in ('explanation', 'reference', 'media'):
            if q[key]:
                item[key] = q[key]
        if q['status'] != 'active':
            item['status'] = q['status']
        if q['calibration_level']:
            item['calibration_level'] = q['calibration_level']
        if q['flags'] and any(q['flags'].values()):
            item['flags'] = q['flags']
        if q['extra']:
            item.update(q['extra'])
        out.append(item)

    data = {
        'format': 'trainingkiosk-questions',
        'format_version': 2,
        'exported_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'questions': out,
    }
    with open(dest, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f"Wrote {len(out)} questions to {dest}")
    for p in problems:
        print(f"  skipped {p}")


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2]) if len(sys.argv) == 3 else src
    convert(src, dest)
