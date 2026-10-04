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


def with_links(page, links, url="https://shop.test/list"):
    """Add ``<a>`` elements: *links* is ``[(card number, text, href)]``; text "" wraps the card."""
    page = {**page, "links": [], "url": url}
    cards = [e for e, el in enumerate(page["els"]) if el["p"] == 1]
    for card_no, text, href in links:
        card = cards[card_no]
        if text:
            e = len(page["els"])
            page["els"].append({"p": card, "x": 110, "y": 0, "w": 50, "h": 18})
        else:
            # An <a> around the whole card: the card's new parent.
            e = len(page["els"])
            page["els"].append({**page["els"][card], "p": 1})
            page["els"][card]["p"] = e
        page["links"].append({"h": href, "e": e, "t": text})
    return page


def test_record_link_is_the_one_named_after_it():
    page = with_links(card_page(BOOKS), [
        (1, "Add to basket", "https://shop.test/basket/add?id=2"),
        (1, "Tipping the Velvet", "https://shop.test/tipping-the-velvet"),
    ])
    boxes = locate_records([{"title": "Tipping the Velvet", "price": 53.74}], page)

    assert boxes[0]["href"] == "https://shop.test/tipping-the-velvet"


def test_link_around_the_card_counts():
    page = with_links(card_page(BOOKS), [(2, "", "https://shop.test/soumission")])
    boxes = locate_records([{"title": "Soumission", "price": 50.10}], page)

    assert boxes[0]["href"] == "https://shop.test/soumission"


def test_action_and_self_links_are_skipped():
    page = with_links(card_page(BOOKS), [
        (0, "upvote", "https://news.test/vote?id=1&how=up"),
        (0, "top", "https://shop.test/list#top"),
    ])
    boxes = locate_records([{"title": "A Light in the Attic", "price": 51.77}], page)

    assert "href" not in boxes[0]


def test_links_in_other_cards_are_not_used():
    page = with_links(card_page(BOOKS), [(0, "A Light in the ...", "https://shop.test/a-light")])
    boxes = locate_records([{"title": "Soumission", "price": 50.10}], page)

    assert "href" not in boxes[0]
