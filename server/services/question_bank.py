"""
Question bank: reads the questions file and keeps the database in step with it.

Runs every time the server starts. For each question in the file:
  - new ID              -> added (version 1)
  - same ID, same text  -> left alone
  - same ID, changed    -> updated, version number goes up, old version kept
  - in DB, not in file  -> marked 'retired' (history is never deleted)
  - status "retired"    -> marked 'retired'

The file format is described in docs/QUESTION_FORMAT.md. Old-style files
(a plain list of questions with no IDs) still work: those questions get an
ID made from their text, exactly like before, so existing history matches.
"""

import hashlib
import json
import re

from server.config import QUESTIONS_FILE

# Fields we understand. Anything else in a question is kept in 'extra'.
KNOWN_FIELDS = {
    'id', 'question', 'answers', 'correct', 'tags', 'explanation',
    'reference', 'media', 'status', 'calibration_level', 'flags',
}
VALID_STATUSES = {'active', 'retired'}
ID_PATTERN = re.compile(r'^[A-Za-z0-9_.:-]{1,64}$')

# The result of the most recent sync, shown by /api/system/health
last_sync_summary = None


# ---------------------------------------------------------------------------
# Helpers (also used by the database upgrade in database.py)
# ---------------------------------------------------------------------------

def legacy_id(question_text):
    """The old way of making an ID: an MD5 hash of the question text."""
    return hashlib.md5(question_text.strip().encode('utf-8')).hexdigest()


def normalize_tags(raw):
    """
    Turns any supported tag style into {tag_type: [values]}.
      {"topic": ["Cardiac"], "scope": "PCP"}  -> {"scope": ["pcp"], "topic": ["cardiac"]}
      ["topic:cardiac", "test"]               -> {"tag": ["test"], "topic": ["cardiac"]}
    Types and values are lower-cased so "Cardiac" and "cardiac" count as one.
    """
    result = {}

    def add(tag_type, value):
        tag_type = str(tag_type).strip().lower()
        value = str(value).strip().lower()
        if tag_type and value:
            result.setdefault(tag_type, set()).add(value)

    if isinstance(raw, dict):
        for tag_type, values in raw.items():
            if isinstance(values, (list, tuple)):
                for v in values:
                    add(tag_type, v)
            elif values is not None:
                add(tag_type, values)
    elif isinstance(raw, (list, tuple)):
        for item in raw:
            text = str(item)
            if ':' in text:
                tag_type, value = text.split(':', 1)
                add(tag_type, value)
            else:
                add('tag', text)

    return {k: sorted(v) for k, v in sorted(result.items())}


def snapshot(q):
    """The parts of a question that make up its 'content' (what gets versioned)."""
    return {
        'question': q.get('question'),
        'answers': q.get('answers'),
        'correct': q.get('correct'),
        'explanation': q.get('explanation'),
        'reference': q.get('reference'),
        'media': q.get('media'),
        'tags': q.get('tags'),
    }


def content_hash(q):
    """A fingerprint of a question's content, used to spot edits."""
    canonical = json.dumps(snapshot(q), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------------------
# Reading and checking the file
# ---------------------------------------------------------------------------

def load_question_file(path=QUESTIONS_FILE):
    """
    Reads the questions file. Returns (format_version, list_of_raw_questions).
    Raises ValueError if the file isn't a usable questions file.
    """
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, list):
        return 1, data
    if isinstance(data, dict) and isinstance(data.get('questions'), list):
        return int(data.get('format_version', 1)), data['questions']
    raise ValueError("File must be a list of questions or an object with a 'questions' list")


def clean_question(raw):
    """
    Checks one question and returns (clean_dict, None) or (None, error_message).
    """
    if not isinstance(raw, dict):
        return None, "not an object"

    text = str(raw.get('question') or '').strip()
    if not text:
        return None, "missing question text"

    answers = raw.get('answers')
    if not isinstance(answers, list) or len(answers) < 2:
        return None, f"needs at least 2 answers: {text[:60]}"
    answers = [str(a).strip() for a in answers]
    if any(not a for a in answers):
        return None, f"has a blank answer: {text[:60]}"
    if len(set(answers)) != len(answers):
        return None, f"has duplicate answers: {text[:60]}"

    correct = str(raw.get('correct') or '').strip()
    if correct not in answers:
        return None, f"'correct' doesn't exactly match one of the answers: {text[:60]}"

    qid = raw.get('id')
    if qid is None or str(qid).strip() == '':
        qid = legacy_id(text)
    qid = str(qid).strip()
    if not ID_PATTERN.match(qid):
        return None, f"invalid id '{qid}' (letters, digits, _ . : - only, max 64)"

    status = str(raw.get('status') or 'active').strip().lower()
    if status not in VALID_STATUSES:
        return None, f"unknown status '{status}' for {qid}"

    media = raw.get('media')
    if media is not None and not isinstance(media, dict):
        return None, f"'media' must be an object for {qid}"

    try:
        calibration = int(raw.get('calibration_level') or 0)
    except (TypeError, ValueError):
        calibration = 0

    extra = {k: v for k, v in raw.items() if k not in KNOWN_FIELDS}

    return {
        'id': qid,
        'question': text,
        'answers': answers,
        'correct': correct,
        'tags': normalize_tags(raw.get('tags') or {}),
        'explanation': (raw.get('explanation') or None),
        'reference': (raw.get('reference') or None),
        'media': media,
        'status': status,
        'calibration_level': calibration,
        'flags': raw.get('flags') if isinstance(raw.get('flags'), dict) else None,
        'extra': extra or None,
    }, None


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

def _write_tags(db, qid, tags):
    db.execute("DELETE FROM question_tags WHERE question_id = ?", (qid,))
    for tag_type, values in tags.items():
        for v in values:
            db.execute("INSERT OR IGNORE INTO question_tags VALUES (?, ?, ?)", (qid, tag_type, v))


def sync_questions(path=QUESTIONS_FILE):
    """
    Brings the database in line with the questions file.
    Returns a summary dict. Never deletes anything.
    """
    global last_sync_summary
    from server.database import get_db

    summary = {
        'file': str(path), 'format_version': None,
        'added': 0, 'updated': 0, 'unchanged': 0,
        'retired': 0, 'reactivated': 0, 'invalid': [],
        'ok': False,
    }

    if not path.exists():
        summary['error'] = 'questions file not found; database left as-is'
        last_sync_summary = summary
        print(f"Question sync: {summary['error']} ({path})")
        return summary

    try:
        summary['format_version'], raw_questions = load_question_file(path)
    except Exception as e:
        summary['error'] = f'could not read questions file; database left as-is: {e}'
        last_sync_summary = summary
        print(f"Question sync: {summary['error']}")
        return summary

    clean = {}
    for i, raw in enumerate(raw_questions):
        q, err = clean_question(raw)
        if err:
            summary['invalid'].append(f"#{i + 1}: {err}")
            continue
        if q['id'] in clean:
            summary['invalid'].append(f"#{i + 1}: duplicate id {q['id']} (kept the first one)")
            continue
        clean[q['id']] = q

    if not clean:
        summary['error'] = 'no valid questions in file; database left as-is'
        last_sync_summary = summary
        print(f"Question sync: {summary['error']}")
        return summary

    with get_db() as db:
        existing = {
            r['id']: r for r in db.execute(
                "SELECT id, version, status, content_hash FROM questions"
            ).fetchall()
        }

        for qid, q in clean.items():
            h = content_hash(q)
            row = existing.get(qid)

            if row is None:
                db.execute('''
                    INSERT INTO questions
                        (id, question, answers, correct, tags, calibration_level, flags,
                         version, status, explanation, reference, media, extra,
                         content_hash, updated_at, retired_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
                            CASE WHEN ? = 'retired' THEN CURRENT_TIMESTAMP END)
                ''', (
                    qid, q['question'], json.dumps(q['answers']), q['correct'],
                    json.dumps(q['tags']), q['calibration_level'],
                    json.dumps(q['flags']) if q['flags'] else None,
                    q['status'], q['explanation'], q['reference'],
                    json.dumps(q['media']) if q['media'] else None,
                    json.dumps(q['extra']) if q['extra'] else None,
                    h, q['status'],
                ))
                db.execute('''
                    INSERT OR IGNORE INTO question_versions (question_id, version, content, content_hash)
                    VALUES (?, 1, ?, ?)
                ''', (qid, json.dumps(snapshot(q)), h))
                _write_tags(db, qid, q['tags'])
                summary['added'] += 1
                continue

            changed = row['content_hash'] != h
            if changed:
                new_version = (row['version'] or 1) + 1
                db.execute('''
                    UPDATE questions
                       SET question = ?, answers = ?, correct = ?, tags = ?,
                           explanation = ?, reference = ?, media = ?,
                           version = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?
                ''', (
                    q['question'], json.dumps(q['answers']), q['correct'], json.dumps(q['tags']),
                    q['explanation'], q['reference'],
                    json.dumps(q['media']) if q['media'] else None,
                    new_version, h, qid,
                ))
                db.execute('''
                    INSERT OR IGNORE INTO question_versions (question_id, version, content, content_hash)
                    VALUES (?, ?, ?, ?)
                ''', (qid, new_version, json.dumps(snapshot(q)), h))
                _write_tags(db, qid, q['tags'])
                summary['updated'] += 1
            else:
                summary['unchanged'] += 1

            # Non-content fields: always take the file's value
            db.execute(
                "UPDATE questions SET calibration_level = ?, extra = ? WHERE id = ?",
                (q['calibration_level'], json.dumps(q['extra']) if q['extra'] else None, qid),
            )

            # Status changes
            if q['status'] == 'retired' and row['status'] != 'retired':
                db.execute("UPDATE questions SET status = 'retired', retired_at = CURRENT_TIMESTAMP WHERE id = ?", (qid,))
                summary['retired'] += 1
            elif q['status'] == 'active' and row['status'] == 'retired':
                db.execute("UPDATE questions SET status = 'active', retired_at = NULL WHERE id = ?", (qid,))
                summary['reactivated'] += 1

        # Anything active in the database but missing from the file is retired.
        for qid, row in existing.items():
            if qid not in clean and row['status'] != 'retired':
                db.execute("UPDATE questions SET status = 'retired', retired_at = CURRENT_TIMESTAMP WHERE id = ?", (qid,))
                summary['retired'] += 1

        db.commit()

    summary['ok'] = True
    last_sync_summary = summary
    print(
        f"Question sync: +{summary['added']} new, {summary['updated']} updated, "
        f"{summary['unchanged']} unchanged, {summary['retired']} retired, "
        f"{summary['reactivated']} reactivated, {len(summary['invalid'])} invalid"
    )
    for msg in summary['invalid'][:20]:
        print(f"  invalid question {msg}")
    return summary
