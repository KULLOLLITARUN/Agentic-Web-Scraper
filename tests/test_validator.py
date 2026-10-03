import pytest

from scraper.validator import ValidationError, Validator


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
