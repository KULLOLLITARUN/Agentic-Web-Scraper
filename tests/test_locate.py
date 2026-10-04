from scraper.locate import locate_records


def card_page(cards, extra_texts=()):
    """A list page: body > list > one card per entry, each card holding its texts.

    *cards* is a list of text lists. Cards are 200x300, stacked vertically.
    """
    els = [{"p": -1, "x": 0, "y": 0, "w": 1000, "h": 400 * len(cards) + 400}]  # body
    els.append({"p": 0, "x": 100, "y": 0, "w": 800, "h": 400 * len(cards)})  # list
    texts = []
    for n, card_texts in enumerate(cards):
        card = len(els)
        els.append({"p": 1, "x": 100, "y": 400 * n, "w": 200, "h": 300})
        for k, t in enumerate(card_texts):
            line = len(els)
            els.append({"p": card, "x": 110, "y": 400 * n + 20 * k, "w": 180, "h": 18})
            texts.append({"t": t, "e": line})
    for t in extra_texts:
        texts.append({"t": t, "e": 0})
    return {"els": els, "texts": texts}


BOOKS = [
    ["A Light in the ...", "£51.77", "In stock"],
    ["Tipping the Velvet", "£53.74", "In stock"],
    ["Soumission", "£50.10", "In stock"],
]


def test_each_record_gets_its_card():
    records = [
        {"title": "A Light in the Attic", "price": 51.77},  # shortened on the page
        {"title": "Tipping the Velvet", "price": 53.74},
        {"title": "Soumission", "price": 50.10},
    ]
    boxes = locate_records(records, card_page(BOOKS))

    assert [boxes[i]["y"] for i in range(3)] == [0, 400, 800]
    assert all(b["w"] == 200 and b["h"] == 300 for b in boxes.values())


def test_look_alike_records_get_different_cards():
    page = card_page([
        ["AI / ML Engineer", "Accenture", "2-5 Yrs", "nlp"],
        ["AI / ML Engineer", "Accenture", "5-10 Yrs", "vision"],
        ["AI / ML Engineer", "Accenture", "12-17 Yrs", "chatbot"],
    ])
    records = [
        {"title": "AI / ML Engineer", "company": "Accenture", "experience": "12-17 Yrs", "skills": ["chatbot"]},
        {"title": "AI / ML Engineer", "company": "Accenture", "experience": "2-5 Yrs", "skills": ["nlp"]},
        {"title": "AI / ML Engineer", "company": "Accenture", "experience": "5-10 Yrs", "skills": ["vision"]},
    ]
    boxes = locate_records(records, page)

    assert boxes[0]["y"] == 800 and boxes[1]["y"] == 0 and boxes[2]["y"] == 400


def test_record_not_on_the_page_gets_no_box():
    records = [{"title": "Soumission", "price": 50.10}, {"title": "Not There", "price": 9.99}]
    boxes = locate_records(records, card_page(BOOKS))

    assert set(boxes) == {0}


def test_one_matching_value_is_not_enough():
    # Only the price matches (and it's in a sidebar too): don't guess.
    records = [{"title": "Something Else", "price": 51.77}]
    assert locate_records(records, card_page(BOOKS, extra_texts=["£51.77"])) == {}


def test_page_without_repeated_blocks_gets_nothing():
    page = {"els": [{"p": -1, "x": 0, "y": 0, "w": 800, "h": 600}], "texts": [{"t": "Soumission £50.10", "e": 0}]}
    assert locate_records([{"title": "Soumission", "price": 50.10}], page) == {}


def test_no_layout_means_no_boxes():
    assert locate_records([{"a": "b"}], None) == {}
