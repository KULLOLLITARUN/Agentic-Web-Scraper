import pytest

from scraper.validator import SchemaMismatchError, ValidationError, Validator, parse_schema_fields


@pytest.fixture
def v():
    return Validator()


def test_parses_plain_json(v):
    assert v.run_all('[{"a": 1}, {"a": 2}]') == [{"a": 1}, {"a": 2}]
    assert v.repaired is False


def test_strips_markdown_fences(v):
    assert v.run_all('```json\n[{"a": 1}]\n```') == [{"a": 1}]


def test_repairs_output_cut_off_mid_object(v):
    data = v.run_all('[{"a": 1}, {"a": 2}, {"a": "trunc')

    assert data == [{"a": 1}, {"a": 2}]
    assert v.repaired is True


def test_stray_closing_bracket_is_not_treated_as_cut_off(v):
    # Real gpt-oss output on quotes.toscrape.com page 10 ended with "}]]".
    data = v.run_all('[{"a": 1}, {"a": 2}]]')

    assert data == [{"a": 1}, {"a": 2}]
    assert v.repaired is False


def test_second_value_after_json_is_not_dropped_silently(v):
    # Only stray closers are ignored; a second array is an error to retry,
    # not something to cut down to the first array.
    with pytest.raises(ValidationError, match="Invalid JSON"):
        v.run_all('[{"a": 1}] [{"a": 2}]')


def test_repaired_flag_resets_on_next_parse(v):
    v.run_all('[{"a": 1}, {"a": ')
    v.run_all('[{"a": 1}]')

    assert v.repaired is False


def test_unrepairable_json_raises(v):
    with pytest.raises(ValidationError, match="Invalid JSON"):
        v.run_all("not json at all")


def test_list_required_when_expected(v):
    with pytest.raises(ValidationError, match="Expected a JSON array"):
        v.run_all('{"a": 1}', expect_list=True)


def test_object_allowed_when_list_not_expected(v):
    assert v.run_all('{"a": 1}', expect_list=False) == {"a": 1}


def test_empty_items_are_dropped(v):
    assert v.run_all('[{"a": 1}, {}, null]') == [{"a": 1}]


def test_all_empty_items_raises(v):
    with pytest.raises(ValidationError, match="empty"):
        v.run_all("[{}, null]")


# ── Field checking ──────────────────────────────────────────────────────────


def test_parses_fields_and_types_from_plain_english():
    schema = (
        "Each book: title (string), price (float, no currency symbol), rating (string), "
        "in_stock (boolean), rank (int), points (int or null), tags (list of strings)"
    )
    assert parse_schema_fields(schema) == {
        "title": "string",
        "price": "float",
        "rating": "string",
        "in_stock": "bool",
        "rank": "int",
        "points": "int",
        "tags": "list",
    }


def test_ignores_parentheses_without_a_type():
    assert parse_schema_fields("Extract items (all of them) from the page") == {}


def test_free_form_schema_skips_field_checks(v):
    assert v.run_all('[{"anything": 1}]', schema_description="the job listings") == [{"anything": 1}]


def test_unambiguous_values_are_converted(v):
    data = v.run_all(
        '[{"rank": "3", "points": "1,234", "price": "12.50", "ok": "yes", "title": 42}]',
        schema_description="rank (int), points (int), price (float), ok (bool), title (string)",
    )
    assert data == [{"rank": 3, "points": 1234, "price": 12.5, "ok": True, "title": "42"}]


def test_null_is_always_allowed(v):
    data = v.run_all('[{"points": null}]', schema_description="points (int)")
    assert data == [{"points": None}]


@pytest.mark.parametrize(
    "item, problem",
    [
        ('{"price": "$12.99"}', '"price" should be a number, got "$12.99"'),
        ('{"price": "1,2,3"}', '"price" should be a number, got "1,2,3"'),
        ('{"price": true}', '"price" should be a number, got true'),
        ('{"rank": 2.5}', '"rank" should be a whole number, got 2.5'),
        ('{"tags": "a, b"}', '"tags" should be a list, got "a, b"'),
        ('{"ok": "maybe"}', '"ok" should be true/false, got "maybe"'),
        ('{"other": 1}', 'missing "price"'),
    ],
)
def test_reports_wrong_or_missing_fields(v, item, problem):
    fields = {"price": "price (float)", "rank": "rank (int)", "tags": "tags (list)", "ok": "ok (bool)"}
    key = next((k for k in fields if f'"{k}"' in item), "price")
    with pytest.raises(SchemaMismatchError) as exc:
        v.run_all(f"[{item}]", schema_description=fields[key])

    assert problem in exc.value.problems[0]
    assert exc.value.problems[0].startswith("item 1: ")


def test_mismatch_error_keeps_converted_data_and_lists_every_problem(v):
    with pytest.raises(SchemaMismatchError) as exc:
        v.run_all(
            '[{"rank": "1", "title": "a"}, {"rank": "x"}, {"title": "c"}]',
            schema_description="rank (int), title (string)",
        )

    assert exc.value.data[0] == {"rank": 1, "title": "a"}
    assert exc.value.problems == [
        'item 2: "rank" should be a whole number, got "x"',
        'item 2: missing "title" (use null if the page has no value)',
        'item 3: missing "rank" (use null if the page has no value)',
    ]


def test_mismatch_message_is_capped_for_the_model(v):
    items = ",".join('{"rank": "x"}' for _ in range(20))
    with pytest.raises(SchemaMismatchError) as exc:
        v.run_all(f"[{items}]", schema_description="rank (int)")

    assert len(exc.value.problems) == 20
    assert "...and 12 more" in str(exc.value)


def test_single_object_problems_have_no_item_prefix(v):
    with pytest.raises(SchemaMismatchError) as exc:
        v.run_all('{"rank": "x"}', expect_list=False, schema_description="rank (int)")

    assert exc.value.problems == ['"rank" should be a whole number, got "x"']


def test_allow_empty_accepts_a_list_with_no_items(v):
    assert v.run_all("[]", allow_empty=True) == []
    assert v.run_all("[{}, null]", allow_empty=True) == []
