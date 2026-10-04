from scraper.chunking import BOUNDARY_ITEMS, merge_items, split_text


def lines(n, width=99):
    return "".join(f"{i:04d} " + "x" * (width - 5) + "\n" for i in range(n))


def test_short_text_is_one_part():
    text = lines(50)  # 5,000 chars
    assert split_text(text, size=12_000) == [text]


def test_small_tail_is_merged_into_the_last_part():
    text = lines(140)  # 14,000 chars: 12,000 + a 2,000 tail
    assert split_text(text, size=12_000) == [text]


def test_long_text_splits_at_line_ends_with_overlap():
    text = lines(400)  # 40,000 chars
    parts = split_text(text, size=12_000, overlap=1_500)

    assert len(parts) >= 3
    assert all(p.endswith("\n") or p == parts[-1] for p in parts)
    assert all(len(p) <= 12_000 * 1.25 for p in parts)
    for before, after in zip(parts, parts[1:]):
        # The next part starts with a whole line from the end of this one.
        first_line = after.splitlines()[0]
        assert first_line in before
        assert len(before) - before.index(first_line) <= 1_500 + 100
    # Nothing is lost: every line is in some part.
    assert all(any(line in p for p in parts) for line in text.splitlines())


def test_text_without_newlines_still_splits():
    parts = split_text("a" * 40_000, size=12_000, overlap=1_500)

    assert len(parts) >= 3
    assert sum(len(p) for p in parts) >= 40_000


def test_repeat_from_overlap_is_dropped():
    kept = [{"title": "A"}, {"title": "B"}]
    new = [{"title": "b "}, {"title": "C"}]

    assert merge_items(kept, new) == [{"title": "C"}]


def test_repeat_with_missing_field_fills_it_in():
    kept = [{"title": "A", "price": None}]
    new = [{"title": "A", "price": 3.5}, {"title": "B", "price": 1.0}]

    assert merge_items(kept, new) == [{"title": "B", "price": 1.0}]
    assert kept == [{"title": "A", "price": 3.5}]


def test_look_alike_items_that_differ_are_kept():
    kept = [{"title": "AI / ML Engineer", "company": "Accenture", "experience": "2-5 Yrs"}]
    new = [{"title": "AI / ML Engineer", "company": "Accenture", "experience": "5-10 Yrs"}]

    assert merge_items(kept, new) == new


def test_identical_items_far_from_the_boundary_are_kept():
    kept = [{"n": 1}] + [{"n": i} for i in range(2, 2 + BOUNDARY_ITEMS)]
    new = [{"n": 100 + i} for i in range(BOUNDARY_ITEMS)] + [{"n": 1}]

    assert merge_items(kept, new) == new


def test_each_kept_item_absorbs_only_one_repeat():
    kept = [{"title": "A"}]
    new = [{"title": "A"}, {"title": "A"}]

    assert merge_items(kept, new) == [{"title": "A"}]


def test_long_overlap_of_short_rows_is_dropped():
    # Real Wikipedia population table: ~15 rows repeated at each part boundary.
    kept = [{"name": f"Country {i}", "population": 1000 - i} for i in range(117)]
    new = kept[101:] + [{"name": f"Country {i}", "population": 1000 - i} for i in range(117, 130)]

    fresh = merge_items(kept, [dict(item) for item in new])

    assert [item["name"] for item in fresh] == [f"Country {i}" for i in range(117, 130)]
