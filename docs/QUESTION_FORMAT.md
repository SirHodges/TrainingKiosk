# Question file format (v2)

The kiosk reads `data/questions.json` every time it starts. This is the file
the future question-bank website will export.

## File

```json
{
  "format": "trainingkiosk-questions",
  "format_version": 2,
  "exported_at": "2026-10-14T18:00:00Z",
  "questions": [ ... ]
}
```

An old-style file (just a list of questions) still works.

## Question

```json
{
  "id": "card-0042",
  "question": "Which rhythm is shown?",
  "answers": ["Sinus tachycardia", "Atrial flutter", "SVT", "Atrial fibrillation"],
  "correct": "Atrial flutter",
  "tags": {
    "topic": ["cardiac", "ecg"],
    "source": ["als pcs"],
    "scope": ["acp"],
    "difficulty": ["3"]
  },
  "explanation": "Sawtooth flutter waves at ~300/min with 2:1 block.",
  "reference": "ALS PCS v5.4",
  "media": { "image": "question_media/ecg_0042.png", "alt": "12-lead ECG", "credit": "..." },
  "status": "active",
  "calibration_level": 0
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | Recommended | Permanent. Never reuse or change it. Letters, digits, `_ . : -`, max 64. If missing, the kiosk makes one from the question text (old behaviour), which breaks history if the text is edited. |
| `question` | Yes | |
| `answers` | Yes | 2 or more, no blanks, no duplicates. |
| `correct` | Yes | Must exactly match one of `answers`. |
| `tags` | No | Any tag types you like: `{"type": ["value", ...]}`. Lower-cased on import. New tag types need no code changes. A list like `["topic:cardiac", "test"]` also works (plain words become type `tag`). |
| `explanation` | No | Stored now, shown after answering in a future version. |
| `reference` | No | Source citation. |
| `media` | No | Image info. Stored now, displayed in a future version. |
| `status` | No | `active` (default) or `retired`. |
| `calibration_level` | No | Integer, kept from v1. |

Any other fields are kept as-is in the database (`extra`), so the website can
add fields without breaking the kiosk.

## What happens on import

| Situation | Result |
|---|---|
| New `id` | Added as version 1 |
| Same `id`, content unchanged | Nothing |
| Same `id`, question/answers/correct/tags/explanation/reference/media changed | Updated, version +1, old version kept in `question_versions` |
| `status: "retired"`, or missing from the file | Retired: no longer dealt, history kept |
| Retired question comes back as active | Reactivated |
| Invalid question | Skipped and listed in `/api/system/health` → `last_question_sync` |
| Whole file unreadable or empty | Nothing changes |

Nothing is ever deleted.

## Converting an old file

```
python scripts/convert_questions.py data/questions.json
```

## Research data recorded per answer (`answer_log`)

question id and version, game module, player slot (1/2), OASIS number (if
entered), answer chosen (screen position, text, and position in the file),
the order answers were shown in, correct/skipped, time to answer (ms),
streak, session id, timestamp.
