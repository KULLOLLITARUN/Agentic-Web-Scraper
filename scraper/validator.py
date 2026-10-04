"""
validator.py
~~~~~~~~~~~~
Self-healing validation engine for LLM JSON responses.
"""

import json
import re
from typing import Any


class ValidationError(Exception):
    """Raised when an LLM response fails structural or content validation."""


class SchemaMismatchError(ValidationError):
    """Raised when valid JSON doesn't match the fields the user described.

    Unlike other validation errors the data is usable, so it is attached
    (with safe type coercions already applied) for callers that would rather
    keep it with a warning than fail outright.
    """

    def __init__(self, problems: list[str], data: Any) -> None:
        self.problems = problems
        self.data = data
        shown = problems[:MAX_PROBLEMS_REPORTED]
        more = len(problems) - len(shown)
        message = "Output doesn't match the requested fields:\n- " + "\n- ".join(shown)
        if more:
            message += f"\n- ...and {more} more"
        super().__init__(message)


MAX_PROBLEMS_REPORTED = 8

# `name (type ...)`, e.g. "price (float, no currency symbol)" or "tags (list of strings)".
_FIELD_RE = re.compile(r"([A-Za-z_]\w*)\s*\(([^()]*)\)")

# Checked in order: "list of ints" is a list, not an int.
_TYPE_KEYWORDS = [
    ("list", re.compile(r"\b(list|array)\b")),
    ("bool", re.compile(r"\bbool(ean)?\b")),
    ("float", re.compile(r"\b(float|number|decimal|double)\b")),
    ("int", re.compile(r"\b(int|integer)\b")),
    ("string", re.compile(r"\b(str|string|text|url)\b")),
]

_NUMBER_RE = re.compile(r"-?[\d,]+(?:\.\d+)?")
_THOUSANDS_RE = re.compile(r"\d{1,3}(?:,\d{3})+")
_BOOL_STRINGS = {"true": True, "yes": True, "false": False, "no": False}


def parse_schema_fields(schema_description: str) -> dict[str, str]:
    """Extract ``{field: type}`` from a plain-English schema description.

    Only ``name (type)`` pairs whose parenthesis names a known type are
    used, so prose like "extract items (all of them)" isn't mistaken for a
    field. Returns an empty dict when nothing recognisable is found.
    """
    fields: dict[str, str] = {}
    for name, spec in _FIELD_RE.findall(schema_description or ""):
        spec = spec.lower()
        for type_name, pattern in _TYPE_KEYWORDS:
            if pattern.search(spec):
                fields[name] = type_name
                break
    return fields


def _parse_number_text(text: str) -> float | None:
    """Parse plain numeric text like ``"12"``, ``"-3.5"`` or ``"1,234"``; else ``None``."""
    text = text.strip()
    if not _NUMBER_RE.fullmatch(text):
        return None
    whole = text.lstrip("-").split(".")[0]
    if "," in whole and not _THOUSANDS_RE.fullmatch(whole):
        return None  # "1,2,3" isn't a number
    return float(text.replace(",", ""))


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        return _parse_number_text(value)
    return None


def _coerce_int(value: Any) -> tuple[Any, bool]:
    number = _as_number(value)
    if number is None or not number.is_integer():
        return value, False
    return int(number), True


def _coerce_float(value: Any) -> tuple[Any, bool]:
    number = _as_number(value)
    return (value, False) if number is None else (number, True)


def _coerce_bool(value: Any) -> tuple[Any, bool]:
    if isinstance(value, bool):
        return value, True
    key = value.strip().lower() if isinstance(value, str) else None
    return (_BOOL_STRINGS[key], True) if key in _BOOL_STRINGS else (value, False)


def _coerce_string(value: Any) -> tuple[Any, bool]:
    if isinstance(value, str):
        return value, True
    if isinstance(value, bool):
        return str(value).lower(), True
    if isinstance(value, (int, float)):
        return str(value), True
    return value, False


_COERCERS = {
    "list": lambda v: (v, isinstance(v, list)),
    "bool": _coerce_bool,
    "float": _coerce_float,
    "int": _coerce_int,
    "string": _coerce_string,
}


def _coerce(value: Any, expected: str) -> tuple[Any, bool]:
    """Return ``(value, ok)``, converting unambiguous cases like ``"12"`` → ``12``.

    ``None`` is always accepted: real pages often lack a value.
    """
    if value is None:
        return None, True
    return _COERCERS[expected](value)


_TYPE_LABELS = {"list": "a list", "bool": "true/false", "float": "a number", "int": "a whole number", "string": "text"}


def _check_record(record: Any, fields: dict[str, str]) -> list[str]:
    """Coerce *record*'s fields in place and return what's still wrong."""
    if not isinstance(record, dict):
        return [f"expected an object with fields {', '.join(fields)}, got {type(record).__name__}"]
    problems = []
    for name, expected in fields.items():
        if name not in record:
            problems.append(f'missing "{name}" (use null if the page has no value)')
            continue
        record[name], ok = _coerce(record[name], expected)
        if not ok:
            got = json.dumps(record[name], ensure_ascii=False)
            if len(got) > 40:
                got = got[:37] + "..."
            problems.append(f'"{name}" should be {_TYPE_LABELS[expected]}, got {got}')
    return problems


class Validator:
    """Validates and sanitises raw JSON responses produced by the LLM.

    The validator provides a layered pipeline:

    1. Strip markdown code fences that the LLM may accidentally include.
    2. Parse the cleaned string as JSON.
    3. Optionally assert that the root value is a JSON array.
    4. Optionally assert that the array contains at least one non-empty item.
    """

    # Matches ```json ... ``` or ``` ... ``` (greedy, DOTALL)
    _FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)

    #: Set by :meth:`parse` — ``True`` when the last response was cut off and
    #: had to be repaired, which means trailing items were dropped.
    repaired: bool = False

    def clean_json_response(self, raw: str) -> str:
        """Strip markdown code fences from *raw* and return trimmed text.

        If a fenced block is found (e.g. ````json ... ````), the content
        inside the fence is extracted.  Otherwise the original string is
        returned after stripping leading/trailing whitespace.

        Args:
            raw: The raw string returned by the LLM.

        Returns:
            A string with code fences removed, ready for ``json.loads``.
        """
        match = self._FENCE_RE.search(raw)
        if match:
            return match.group(1).strip()
        return raw.strip()

    def repair_truncated_json(self, text: str) -> Any:
        """Attempt to repair JSON that was cut off mid-stream due to token limits."""
        text = text.strip()

        # Case 1: Array of objects where the last object was cut off mid-way
        last_brace = text.rfind("}")
        if last_brace != -1:
            truncated = text[:last_brace + 1].strip()
            if truncated.endswith(","):
                truncated = truncated[:-1].strip()
            if truncated.startswith("[") and not truncated.endswith("]"):
                truncated += "]"
            try:
                parsed = json.loads(truncated)
                if isinstance(parsed, (list, dict)) and len(parsed) > 0:
                    return parsed
            except Exception:
                pass

        # Case 2: Incomplete string near end, try closing string and braces
        for closer in ['"]}', '"}', '"]', '"', '}', ']']:
            try:
                parsed = json.loads(text + closer)
                if isinstance(parsed, (list, dict)) and len(parsed) > 0:
                    return parsed
            except Exception:
                continue

        return None

    def parse(self, raw_response: str) -> Any:
        """Clean and parse *raw_response* as JSON.

        Args:
            raw_response: The raw LLM output.

        Returns:
            The deserialised Python object (``dict``, ``list``, etc.).

        Raises:
            ValidationError: If the cleaned string is not valid JSON.
        """
        self.repaired = False
        cleaned = self.clean_json_response(raw_response)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            # A complete value followed only by stray closers (gpt-oss sometimes
            # ends with "}]]") wasn't cut off, so don't flag it as repaired.
            try:
                value, end = json.JSONDecoder().raw_decode(cleaned)
            except json.JSONDecodeError:
                pass
            else:
                if not cleaned[end:].strip(" \t\r\n]},"):
                    return value
            repaired = self.repair_truncated_json(cleaned)
            if repaired is not None:
                self.repaired = True
                return repaired
            raise ValidationError(
                f"Invalid JSON: {e}. Raw response was: {raw_response[:200]}"
            ) from e

    def validate_is_list(self, data: Any) -> list:
        """Assert that *data* is a JSON array (Python ``list``).

        Args:
            data: The parsed JSON value.

        Returns:
            *data* unchanged if it is a ``list``.

        Raises:
            ValidationError: If *data* is not a ``list``.
        """
        if not isinstance(data, list):
            raise ValidationError(
                "Expected a JSON array [...] but got a dict/other type. "
                "Wrap items in an array."
            )
        return data

    def validate_no_empty_items(self, items: list) -> list:
        """Filter empty items and assert the result is non-empty.

        Empty items are defined as ``None`` values or empty dicts ``{}``.

        Args:
            items: The list of extracted data items.

        Returns:
            A new list with all empty items removed.

        Raises:
            ValidationError: If every item was empty (nothing was extracted).
        """
        filtered = [item for item in items if item is not None and item != {}]
        if not filtered:
            raise ValidationError(
                "All extracted items were empty. The AI found no data. "
                "Check your schema description or the website may require "
                "JavaScript rendering."
            )
        return filtered

    def validate_fields(self, data: Any, fields: dict[str, str]) -> Any:
        """Check each record has the requested *fields* with the right types.

        Unambiguous values are converted in place of failing (``"12"`` → 12
        for an int, ``"true"`` → True for a bool). Missing keys and values of
        the wrong kind (``"$12.99"`` for a float) are reported.

        Args:
            data: A parsed record (``dict``) or list of records.
            fields: ``{name: type}`` from :func:`parse_schema_fields`.

        Returns:
            *data* with coercions applied.

        Raises:
            SchemaMismatchError: Listing every problem, with the coerced data
                attached.
        """
        if not fields:
            return data
        records = data if isinstance(data, list) else [data]
        multiple = isinstance(data, list)
        problems: list[str] = []

        for index, record in enumerate(records, start=1):
            where = f"item {index}: " if multiple else ""
            problems += [where + p for p in _check_record(record, fields)]

        if problems:
            raise SchemaMismatchError(problems, data)
        return data

    def run_all(
        self,
        raw_response: str,
        expect_list: bool = True,
        schema_description: str | None = None,
        allow_empty: bool = False,
    ) -> Any:
        """Run the full validation pipeline on *raw_response*.

        Steps:

        1. :meth:`parse` — strip fences and decode JSON.
        2. :meth:`validate_is_list` — enforce array root (if *expect_list*).
        3. :meth:`validate_no_empty_items` — remove empties, assert non-empty.
        4. :meth:`validate_fields` — check the fields named in
           *schema_description* (skipped if none are recognisable).

        Args:
            raw_response: The raw string returned by the LLM.
            expect_list: When ``True`` (default), the JSON root must be an
                array and at least one non-empty item must be present.
                When ``False``, only JSON validity is checked.
            schema_description: The user's field description, e.g.
                ``"title (string), price (float)"``.
            allow_empty: Accept a list with no items (one part of a long
                page may have none) instead of raising.

        Returns:
            The validated (and possibly filtered and coerced) Python object.

        Raises:
            SchemaMismatchError: If the JSON is usable but fields are missing
                or have the wrong type.
            ValidationError: If any other validation step fails.
        """
        data = self.parse(raw_response)
        if expect_list:
            data = self.validate_is_list(data)
            if allow_empty:
                data = [item for item in data if item is not None and item != {}]
            else:
                data = self.validate_no_empty_items(data)
        return self.validate_fields(data, parse_schema_fields(schema_description or ""))
