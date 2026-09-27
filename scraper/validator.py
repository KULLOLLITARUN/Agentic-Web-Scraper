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
        cleaned = self.clean_json_response(raw_response)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            repaired = self.repair_truncated_json(cleaned)
            if repaired is not None:
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

    def run_all(self, raw_response: str, expect_list: bool = True) -> Any:
        """Run the full validation pipeline on *raw_response*.

        Steps:

        1. :meth:`parse` — strip fences and decode JSON.
        2. :meth:`validate_is_list` — enforce array root (if *expect_list*).
        3. :meth:`validate_no_empty_items` — remove empties, assert non-empty.

        Args:
            raw_response: The raw string returned by the LLM.
            expect_list: When ``True`` (default), the JSON root must be an
                array and at least one non-empty item must be present.
                When ``False``, only JSON validity is checked.

        Returns:
            The validated (and possibly filtered) Python object.

        Raises:
            ValidationError: If any validation step fails.
        """
        data = self.parse(raw_response)
        if expect_list:
            data = self.validate_is_list(data)
            data = self.validate_no_empty_items(data)
        return data
