#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

CSV_PATH = Path("public/transformative-canon-with-transformative-experience.csv")
MATCH_CACHE_PATH = Path("/tmp/ol_book_matches.json")
MAX_GENRES = 3

PRIORITY = [
    "Science Fiction",
    "Fantasy",
    "Magical Realism",
    "Dystopian Fiction",
    "Cyberpunk",
    "Alternate History",
    "Horror",
    "Gothic Fiction",
    "Mystery",
    "Crime Fiction",
    "Thriller",
    "Adventure",
    "Western",
    "War Fiction",
    "Historical Fiction",
    "Religious Fiction",
    "Philosophical Fiction",
    "Psychological Fiction",
    "Coming of Age",
    "Satire",
    "Romance",
    "Experimental Fiction",
    "Short Stories",
    "Essays",
    "Memoir",
    "Journalism",
    "Travel Writing",
    "Nature Writing",
    "Literary Criticism",
    "Philosophy",
    "Political Theory",
    "Religion",
    "Spirituality",
    "Drama",
    "Graphic Novel",
    "Epic Poetry",
    "Poetry",
    "Mythology",
    "Children's Fiction",
    "Literary Fiction",
]

NONFICTION_GENRES = {
    "Essays",
    "Memoir",
    "Journalism",
    "Travel Writing",
    "Nature Writing",
    "Literary Criticism",
    "Philosophy",
    "Political Theory",
    "Religion",
    "Spirituality",
}

FORM_GENRES = {
    "Short Stories",
    "Drama",
    "Graphic Novel",
    "Epic Poetry",
    "Poetry",
}

STRONGLY_SPECIFIC_FICTION = {
    "Science Fiction",
    "Fantasy",
    "Magical Realism",
    "Dystopian Fiction",
    "Cyberpunk",
    "Alternate History",
    "Horror",
    "Gothic Fiction",
    "Mystery",
    "Crime Fiction",
    "Thriller",
    "Adventure",
    "Western",
    "War Fiction",
}

SUBJECT_PATTERNS = [
    (("science fiction",), "Science Fiction", 9),
    (("cyberpunk",), "Cyberpunk", 9),
    (("dystopia", "dystopian"), "Dystopian Fiction", 8),
    (("alternative history", "alternate history"), "Alternate History", 8),
    (("magical realism", "magic realism"), "Magical Realism", 9),
    (("horror", "horror tales", "ghost stories", "supernatural"), "Horror", 8),
    (("gothic",), "Gothic Fiction", 8),
    (("western", "frontier"), "Western", 8),
    (("psychological fiction", "fiction, psychological"), "Psychological Fiction", 7),
    (("essays", "essay"), "Essays", 9),
    (("memoir", "memoirs"), "Memoir", 9),
    (("political philosophy", "political science"), "Political Theory", 8),
    (("epic poetry",), "Epic Poetry", 9),
    (("mythology",), "Mythology", 8),
    (("literary fiction",), "Literary Fiction", 6),
]

TEXT_PATTERNS = [
    (("narnia",), "Fantasy", 8),
    (("narnia",), "Children's Fiction", 7),
    (("science fiction", "sci-fi", "far-future", "future war", "solar system", "alien"), "Science Fiction", 8),
    (("cyberpunk",), "Cyberpunk", 8),
    (("dystopian", "post-apocalyptic"), "Dystopian Fiction", 8),
    (("mythic", "sorcerer", "sorcery", "wizard", "gods"), "Fantasy", 8),
    (("magical realism",), "Magical Realism", 9),
    (("horror", "nightmare", "haunted"), "Horror", 8),
    (("gothic",), "Gothic Fiction", 8),
    (("mystery", "detective"), "Mystery", 7),
    (("crime", "criminal", "noir"), "Crime Fiction", 7),
    (("thriller", "suspense"), "Thriller", 7),
    (("adventure", "expedition", "voyage", "journey"), "Adventure", 7),
    (("western", "gunman", "frontier"), "Western", 8),
    (("world war", "civil war", "battlefield", "holy war", "war novel", "war story"), "War Fiction", 8),
    (("historical", "centuries", "empire"), "Historical Fiction", 6),
    (("religious", "christian", "church", "priest", "missionary", "faith"), "Religious Fiction", 7),
    (("philosophical", "existential"), "Philosophical Fiction", 7),
    (("psychological", "inner life"), "Psychological Fiction", 7),
    (("coming-of-age", "coming of age"), "Coming of Age", 8),
    (("satire", "satirical"), "Satire", 8),
    (("romance", "love story"), "Romance", 7),
    (("experimental", "narrative instability"), "Experimental Fiction", 8),
    (("short-story", "short story", "story collection", "selected stories", "collected stories", "anthology"), "Short Stories", 9),
    (("essays", "essay collection", "collected essays"), "Essays", 9),
    (("memoir", "autobiographical"), "Memoir", 9),
    (("reportage", "reported account", "journalistic"), "Journalism", 9),
    (("travel writing", "travel memoir"), "Travel Writing", 8),
    (("nature writing", "desert", "wilderness"), "Nature Writing", 7),
    (("literary criticism", "criticism"), "Literary Criticism", 7),
    (("philosophy", "meditation on"), "Philosophy", 7),
    (("spirituality", "mysticism"), "Spirituality", 7),
    (("play", "tragedy"), "Drama", 9),
    (("graphic novel", "comics"), "Graphic Novel", 9),
    (("epic poem",), "Epic Poetry", 9),
    (("poetry", "poems"), "Poetry", 8),
    (("mythology",), "Mythology", 8),
]

MANUAL_GENRES_RAW = {
    ("Carlos Castaneda", "The entire Don Juan series"): ["Spirituality", "Philosophy"],
    ("Frank Herbert", "Dune Series (Entire Series)"): ["Science Fiction", "Adventure", "Philosophical Fiction"],
    ("Gene Wolfe", "Soldier of Sidon Series"): ["Historical Fiction", "Fantasy"],
    ("Margaret Atwood", "Oryx and Crake (Entire series also)"): ["Science Fiction", "Dystopian Fiction"],
    ("Shusaku Endo", "The Pendulum"): ["Literary Fiction", "Psychological Fiction"],
    ("Shusaku Endo", "Silence"): ["Historical Fiction", "Religious Fiction"],
    ("Shusaku Endo", "Deep River"): ["Literary Fiction", "Religious Fiction"],
    ("Albert Camus", "The Stranger"): ["Literary Fiction", "Philosophical Fiction"],
    ("Alexandre Dumas", "The Count of Monte Cristo"): ["Adventure", "Historical Fiction"],
    ("Bret Easton Ellis", "American Psycho"): ["Satire", "Psychological Fiction", "Horror"],
    ("Carlos Fuentes", "Aura"): ["Gothic Fiction", "Magical Realism"],
    ("Charles Bukowski", "Hot Water Music"): ["Short Stories", "Literary Fiction"],
    ("Clarice Lispector", "The Hour of the Star"): ["Literary Fiction", "Psychological Fiction"],
    ("Edward Abbey", "Desert Solitaire"): ["Nature Writing", "Memoir", "Travel Writing"],
    ("Edward Abbey", "The Monkey Wrench Gang"): ["Adventure", "Satire", "Literary Fiction"],
    ("David Foster Wallace", "A Supposedly Fun Thing I'll Never Do Again"): ["Essays", "Memoir"],
    ("David Foster Wallace", "Consider the Lobster"): ["Essays"],
    ("Ernst Junger", "Storm of Steel"): ["Memoir", "War Fiction"],
    ("Flannery O'Connor", "Mystery and Manners"): ["Essays", "Literary Criticism"],
    ("Hunter S. Thompson", "Fear and Loathing in Las Vegas"): ["Journalism", "Satire"],
    ("Leslie Marmon Silko", "Storyteller"): ["Short Stories", "Poetry", "Memoir"],
    ("Neil Gaiman", "The Sandman"): ["Graphic Novel", "Fantasy", "Horror"],
    ("John Pistelli", "Major Arcana"): ["Literary Fiction", "Fantasy"],
    ("Don DeLillo", "White Noise"): ["Satire", "Literary Fiction"],
    ("Dostoevsky", "The Gambler"): ["Psychological Fiction", "Literary Fiction"],
    ("Eiji Yoshikawa", "Musashi"): ["Historical Fiction", "Adventure"],
    ("Eiji Yoshikawa", "Taiko"): ["Historical Fiction", "Literary Fiction"],
    ("Elena Ferrante", "My Brilliant Friend"): ["Coming of Age", "Literary Fiction"],
    ("Dan Simmons", "Hyperion series"): ["Science Fiction", "Adventure"],
    ("Franz Kafka", "The Metamorphosis"): ["Literary Fiction", "Philosophical Fiction"],
    ("Franz Kafka", "The Trial"): ["Literary Fiction", "Philosophical Fiction"],
    ("George Saunders", "Tenth of December"): ["Short Stories", "Literary Fiction"],
    ("Goethe", "The Sorrows of Young Werther"): ["Romance", "Literary Fiction"],
    ("Haruki Murakami", "Kafka on the Shore"): ["Magical Realism", "Literary Fiction"],
    ("Haruki Murakami", "Norwegian Wood"): ["Coming of Age", "Literary Fiction"],
    ("Haruki Murakami", "The Wind-Up Bird Chronicle"): ["Magical Realism", "Literary Fiction"],
    ("Herman Hesse", "Siddhartha"): ["Philosophical Fiction", "Spirituality"],
    ("J.R.R. Tolkien", "The Lord of the Rings"): ["Fantasy"],
    ("J.G. Ballard", "Crash"): ["Psychological Fiction", "Literary Fiction"],
    ("J.G. Ballard", "High Rise"): ["Dystopian Fiction", "Satire"],
    ("James Joyce", "A Portrait of the Artist as a Young Man"): ["Coming of Age", "Literary Fiction"],
    ("James Joyce", "Dubliners"): ["Short Stories", "Literary Fiction"],
    ("John Kennedy Toole", "A Confederacy of Dunces"): ["Satire", "Literary Fiction"],
    ("Kazuo Ishiguro", "The Remains of the Day"): ["Historical Fiction", "Literary Fiction"],
    ("Mikhail Bulgakov", "The Master and Margarita"): ["Magical Realism", "Satire", "Fantasy"],
    ("Michael Herr", "Dispatches"): ["Journalism", "Memoir"],
    ("Osamu Dazai", "No Longer Human"): ["Psychological Fiction", "Literary Fiction"],
    ("Philip K. Dick", "Do Androids Dream of Electric Sheep"): ["Science Fiction", "Dystopian Fiction"],
    ("Philip K. Dick", "The Man in the High Castle"): ["Science Fiction", "Alternate History"],
    ("Philip K. Dick", "Ubik"): ["Science Fiction", "Literary Fiction"],
    ("Philip Roth", "The Plot Against America"): ["Alternate History", "Historical Fiction"],
    ("Salman Rushdie", "Midnight's Children"): ["Magical Realism", "Historical Fiction", "Literary Fiction"],
    ("Gabriel Garcia Marquez", "One Hundred Years of Solitude"): ["Magical Realism", "Historical Fiction", "Literary Fiction"],
    ("Juan Rulfo", "Pedro Paramo"): ["Magical Realism", "Literary Fiction"],
    ("Ben Okri", "The Famished Road"): ["Magical Realism", "Coming of Age", "Literary Fiction"],
    ("Salman Rushdie", "The Satanic Verses"): ["Magical Realism", "Literary Fiction"],
    ("Margaret Atwood", "The Handmaid's Tale"): ["Dystopian Fiction", "Science Fiction"],
    ("Margaret Atwood", "The Blind Assassin"): ["Literary Fiction", "Historical Fiction"],
    ("Neil Gaiman", "American Gods"): ["Fantasy", "Mythology"],
    ("Oscar Wilde", "The Picture of Dorian Gray"): ["Gothic Fiction", "Horror", "Psychological Fiction"],
    ("Neal Stephenson", "Cryptonomicon"): ["Historical Fiction", "Thriller"],
    ("Neal Stephenson", "Snow Crash"): ["Science Fiction", "Cyberpunk", "Satire"],
    ("David Mitchell", "The Thousand Autumns of Jacob de Zoet"): ["Historical Fiction", "Literary Fiction"],
    ("David Mitchell", "Bone Clocks"): ["Fantasy", "Literary Fiction"],
    ("Thomas Pynchon", "Gravity's Rainbow"): ["Experimental Fiction", "Historical Fiction", "Science Fiction"],
    ("Herman Melville", "Moby Dick"): ["Adventure", "Literary Fiction"],
    ("Italo Calvino", "Cosmicomics"): ["Science Fiction", "Short Stories"],
    ("Jerzy Kosinski", "The Painted Bird"): ["War Fiction", "Literary Fiction"],
    ("David Foster Wallace", "Infinite Jest"): ["Experimental Fiction", "Literary Fiction"],
    ("Denis Johnson", "Jesus' Son"): ["Short Stories", "Literary Fiction"],
    ("Mark Z. Danielewski", "House of Leaves"): ["Horror", "Experimental Fiction"],
    ("Mark Anthony Jarman", "19 Knives"): ["Short Stories", "Literary Fiction"],
    ("Miguel de Cervantes", "Don Quixote"): ["Adventure", "Satire", "Literary Fiction"],
    ("Robert A. Heinlein", "Stranger in a Strange Land"): ["Science Fiction", "Philosophical Fiction"],
    ("Robert Louis Stevenson", "Treasure Island"): ["Adventure", "Children's Fiction"],
    ("Sherwood Anderson", "Winesburg Ohio"): ["Short Stories", "Literary Fiction"],
    ("Stephen Crane", "The Red Badge of Courage"): ["War Fiction", "Coming of Age"],
    ("Toni Morrison", "Beloved"): ["Historical Fiction", "Horror", "Literary Fiction"],
    ("China Mieville", "Perdido Street Station"): ["Science Fiction", "Fantasy", "Horror"],
    ("Tolkien", "The Silmarillion"): ["Fantasy", "Mythology"],
    ("J.R.R. Tolkien", "Unfinished Tales"): ["Fantasy", "Mythology"],
    ("Gore Vidal", "Burr"): ["Historical Fiction", "Literary Fiction"],
    ("Don DeLillo", "Libra"): ["Historical Fiction", "Literary Fiction"],
    ("Giuseppe Tomasi di Lampedusa", "The Leopard"): ["Historical Fiction", "Literary Fiction"],
    ("John Steinbeck", "The Grapes of Wrath"): ["Historical Fiction", "Literary Fiction"],
    ("William Gibson", "Pattern Recognition"): ["Literary Fiction", "Thriller"],
    ("R. Scott Bakker", "Prince of Nothing series"): ["Fantasy", "Philosophical Fiction"],
    ("Fernando Pessoa", "Book of Disquiet"): ["Literary Fiction", "Philosophical Fiction"],
    ("Yukio Mishima", "Sun & Steel"): ["Essays", "Memoir", "Philosophy"],
    ("Mark Z. Danielewski", "House of Leaves"): ["Horror", "Experimental Fiction"],
    ("Mark Z. Danielewski", "Only Revolutions"): ["Experimental Fiction", "Literary Fiction"],
    ("Mark Z. Danielewski", "Tom's Crossing"): ["Experimental Fiction", "Literary Fiction"],
    ("Gene Wolfe", "Book of the New Sun"): ["Science Fiction", "Fantasy"],
    ("Chaucer", "The Canterbury Tales (in Middle English)"): ["Poetry", "Satire"],
    ("Chaucer", "Troilus and Criseyde"): ["Poetry", "Romance"],
    ("Homer", "The Iliad"): ["Epic Poetry", "Mythology", "War Fiction"],
    ("Homer", "The Odyssey"): ["Epic Poetry", "Adventure", "Mythology"],
    ("Milton", "Paradise Lost"): ["Epic Poetry", "Religion", "Poetry"],
    ("Dante", "Inferno"): ["Epic Poetry", "Religion", "Poetry"],
    ("Dante", "The Divine Comedy"): ["Epic Poetry", "Religion", "Poetry"],
    ("Edmund Spenser", "The Faerie Queene"): ["Epic Poetry", "Fantasy", "Poetry"],
    ("Shakespeare", "Hamlet"): ["Drama"],
    ("Shakespeare", "King Lear"): ["Drama"],
    ("Shakespeare", "Macbeth"): ["Drama"],
    ("Shakespeare", "Othello"): ["Drama"],
    ("Samuel Beckett", "Waiting for Godot"): ["Drama"],
    ("Goethe", "Faust"): ["Drama", "Fantasy", "Poetry"],
    ("Harlan Ellison", "Again Dangerous Visions"): ["Science Fiction", "Short Stories"],
    ("Harlan Ellison", "Deathbird Stories"): ["Short Stories", "Fantasy", "Horror"],
}


def strip_accents(value):
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii")


def normalize_text(value):
    value = strip_accents(value).lower()
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def row_key(author, title):
    return normalize_text(author), normalize_text(title)


MANUAL_GENRES = {
    row_key(author, title): genres for (author, title), genres in MANUAL_GENRES_RAW.items()
}


def load_rows(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_match_cache():
    if not MATCH_CACHE_PATH.exists():
        return {}
    raw = json.loads(MATCH_CACHE_PATH.read_text(encoding="utf-8"))
    matches = {}
    for row in raw:
        matches[row_key(row["author"], row["title"])] = row
    return matches


def score_doc(author, title, doc):
    wanted_title = normalize_text(title)
    wanted_author = normalize_text(author)
    doc_title = normalize_text(doc.get("title", ""))
    doc_author = normalize_text(" ".join(doc.get("author_name", []) or []))

    title_score = 0
    if doc_title == wanted_title:
        title_score = 6
    elif doc_title.startswith(wanted_title) or wanted_title.startswith(doc_title):
        title_score = 5
    elif wanted_title in doc_title or doc_title in wanted_title:
        title_score = 4
    else:
        title_tokens = set(wanted_title.split())
        doc_tokens = set(doc_title.split())
        if title_tokens:
            title_score = 4 * len(title_tokens & doc_tokens) / len(title_tokens)

    author_score = 0
    if doc_author == wanted_author:
        author_score = 4
    else:
        author_tokens = set(wanted_author.split())
        doc_author_tokens = set(doc_author.split())
        if author_tokens:
            author_score = 4 * len(author_tokens & doc_author_tokens) / len(author_tokens)

    return title_score + author_score


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.load(response)


def search_openlibrary(author, title):
    variants = [
        {"title": title, "author": author},
        {"q": f"{title} {author}"},
        {"title": title},
    ]
    best_score = -1
    best_doc = None
    for params in variants:
        params = {**params, "limit": 8, "fields": "key,title,author_name,subject"}
        url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode(params)
        try:
            data = fetch_json(url)
        except Exception:
            continue
        for doc in data.get("docs", []):
            candidate_score = score_doc(author, title, doc)
            if candidate_score > best_score:
                best_score = candidate_score
                best_doc = doc
    return {"score": best_score, "doc": best_doc}


def add_score(scores, genre, weight):
    if genre not in PRIORITY:
        raise ValueError(f"Unknown genre: {genre}")
    if weight > scores[genre]:
        scores[genre] = weight


def matches_any(text, needles):
    for needle in needles:
        pattern = r"(^|[^a-z0-9])" + re.escape(needle) + r"([^a-z0-9]|$)"
        if re.search(pattern, text):
            return True
    return False


def is_noise_subject(subject):
    noise_patterns = (
        "adaptation",
        "comics",
        "graphic novel",
        "graphic novels",
        "comic books",
        "cartoons and comics",
        "study guide",
        "notes",
        "large type",
        "reading level",
        "open_syllabus_project",
        "new york times",
        "award",
        "long now manual for civilization",
        "translations",
        "manuscripts",
        "facsimiles",
        "criticism",
        "literature",
        "classic literature",
        "juvenile literature",
        "grades",
        "popular work",
        "periodicals",
        "specimens",
        "adaptations",
    )
    return any(pattern in subject for pattern in noise_patterns)


def infer_genres(row, match):
    manual = MANUAL_GENRES.get((normalize_text(row["Author"]), normalize_text(row["Title"])))
    if manual:
        return manual[:MAX_GENRES]

    doc = (match or {}).get("doc") or {}
    subjects = [
        strip_accents(subject).lower()
        for subject in doc.get("subject", [])[:25]
        if not is_noise_subject(strip_accents(subject).lower())
    ]
    summary = strip_accents(row.get("Justification", "")).lower()
    title = strip_accents(row["Title"]).lower()
    combined_subjects = " | ".join(subjects)
    combined_text = " | ".join([title, summary])

    scores = defaultdict(int)

    for needles, genre, weight in SUBJECT_PATTERNS:
        if matches_any(combined_subjects, needles):
            add_score(scores, genre, weight)

    for needles, genre, weight in TEXT_PATTERNS:
        if matches_any(combined_text, needles):
            add_score(scores, genre, weight)

    if re.search(r"\b(short stories|selected stories|stories)\b", title) or "story collection" in summary:
        add_score(scores, "Short Stories", 9)
    if re.search(r"\b(essays)\b", title) or "essay collection" in summary:
        add_score(scores, "Essays", 9)
    if "graphic novel" in summary or "comic" in combined_subjects:
        add_score(scores, "Graphic Novel", 9)
    if "memoir" in summary:
        add_score(scores, "Memoir", 9)
    if "play" in summary or "tragedy" in summary:
        add_score(scores, "Drama", 9)
    if "poem" in summary or "poetry" in summary:
        add_score(scores, "Poetry", 8)
    if "anthology" in summary and "Science Fiction" in scores:
        add_score(scores, "Short Stories", 7)

    if row["Title"] == "The Sandman":
        add_score(scores, "Graphic Novel", 9)
        add_score(scores, "Fantasy", 8)

    if row["Title"] == "The Stranger":
        add_score(scores, "Philosophical Fiction", 8)

    chosen = sort_genres(scores)

    if "Epic Poetry" in chosen and "Poetry" in chosen:
        chosen = [genre for genre in chosen if genre != "Poetry"]
    if "Cyberpunk" in chosen and "Science Fiction" not in chosen:
        chosen.insert(0, "Science Fiction")

    if should_add_literary_fiction(chosen, summary):
        chosen.append("Literary Fiction")

    deduped = []
    for genre in chosen:
        if genre not in deduped:
            deduped.append(genre)
        if len(deduped) == MAX_GENRES:
            break

    if not deduped:
        deduped = ["Literary Fiction"]

    return deduped


def sort_genres(scores):
    order = {genre: index for index, genre in enumerate(PRIORITY)}
    return [
        genre
        for genre, _ in sorted(
            scores.items(),
            key=lambda item: (-item[1], order[item[0]]),
        )
        if item_is_useful(genre, scores)
    ]


def item_is_useful(genre, scores):
    if genre == "Literary Fiction":
        return False
    if genre == "Philosophical Fiction" and "Philosophy" in scores:
        return scores[genre] >= scores["Philosophy"]
    return True


def should_add_literary_fiction(genres, summary):
    if not genres:
        return True
    if any(genre in NONFICTION_GENRES for genre in genres):
        return False
    if any(genre in FORM_GENRES for genre in genres) and len(genres) >= 2:
        return False
    if any(genre in STRONGLY_SPECIFIC_FICTION for genre in genres) and len(genres) >= 2:
        return False
    if "Children's Fiction" in genres and "Fantasy" in genres:
        return False
    if "graphic novel" in summary.lower():
        return False
    return "Literary Fiction" not in genres


def update_csv(rows, genres_by_key):
    fieldnames = list(rows[0].keys())
    if "Genres" not in fieldnames:
        fieldnames.append("Genres")
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            genres = genres_by_key[row_key(row["Author"], row["Title"])]
            row["Genres"] = "|".join(genres[:MAX_GENRES])
            writer.writerow(row)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write genres back to the CSV.")
    parser.add_argument("--limit", type=int, default=0, help="Only process the first N rows.")
    args = parser.parse_args()

    rows = load_rows(CSV_PATH)
    matches = load_match_cache()

    genres_by_key = {}
    unresolved = []
    fetched = 0

    for row in rows[: args.limit or None]:
        key = row_key(row["Author"], row["Title"])
        match = matches.get(key)
        if match is None:
            match = search_openlibrary(row["Author"], row["Title"])
            fetched += 1
            time.sleep(0.05)
        genres = infer_genres(row, match)
        genres_by_key[key] = genres
        if genres == ["Literary Fiction"]:
            unresolved.append(row)

    genre_counts = defaultdict(int)
    for genres in genres_by_key.values():
        for genre in genres:
            genre_counts[genre] += 1

    print(f"processed={len(genres_by_key)} fetched_live={fetched}")
    print("top_genres:")
    for genre, count in sorted(genre_counts.items(), key=lambda item: (-item[1], item[0]))[:40]:
        print(f"  {genre}: {count}")

    print("literary_fiction_only:")
    for row in unresolved[:60]:
        print(f"  {row['Author']} - {row['Title']}")

    if args.write:
        if len(genres_by_key) != len(rows):
            print("Refusing to write a partial run.", file=sys.stderr)
            sys.exit(1)
        update_csv(rows, genres_by_key)
        print(f"updated_csv={CSV_PATH}")


if __name__ == "__main__":
    main()
