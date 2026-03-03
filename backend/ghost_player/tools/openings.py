"""Opening book recognition tool for Ghost Player.

Identifies the chess opening being played from the move history.
Uses a prefix-matching approach against a curated book of ~60 openings.
"""

from . import game_state

# ---------------------------------------------------------------------------
# Opening book — (moves_tuple, eco, name, flavour_description)
# Sorted longest-first at module load so the first match is always the
# most specific (deepest) line.
# ---------------------------------------------------------------------------
_OPENINGS: list[tuple[tuple[str, ...], str, str, str]] = [
    # ── Ruy López ───────────────────────────────────────────────────────────
    (("e2e4","e7e5","g1f3","b8c6","f1b5","a7a6","f1a4","g8f6"), "C78", "Ruy López, Morphy Defense", "The mainline Spanish — centuries of theory packed into every move."),
    (("e2e4","e7e5","g1f3","b8c6","f1b5","a7a6"), "C78", "Ruy López, Morphy Defense", "Black challenges the pin at once."),
    (("e2e4","e7e5","g1f3","b8c6","f1b5"), "C60", "Ruy López", "One of the oldest and most respected openings in chess."),

    # ── Italian Game ────────────────────────────────────────────────────────
    (("e2e4","e7e5","g1f3","b8c6","f1c4","f8c5","c2c3","g8f6"), "C54", "Giuoco Piano", "The 'Quiet Game' — positional tension beneath a calm surface."),
    (("e2e4","e7e5","g1f3","b8c6","f1c4","f8c5"), "C50", "Giuoco Piano", "Classical piece development toward the centre."),
    (("e2e4","e7e5","g1f3","b8c6","f1c4","g8f6"), "C55", "Two Knights Defense", "Black counter-attacks immediately — sharp and direct."),
    (("e2e4","e7e5","g1f3","b8c6","f1c4"), "C50", "Italian Game", "One of the oldest openings in recorded chess history."),

    # ── Scotch Game ─────────────────────────────────────────────────────────
    (("e2e4","e7e5","g1f3","b8c6","d2d4","e5d4","f3d4","g8f6"), "C45", "Scotch Game, Classical", "An energetic central battle."),
    (("e2e4","e7e5","g1f3","b8c6","d2d4","e5d4","f3d4"), "C45", "Scotch Game", "White strikes at the centre on move three."),
    (("e2e4","e7e5","g1f3","b8c6","d2d4"), "C44", "Scotch Gambit", "An immediate central challenge."),

    # ── Four Knights ────────────────────────────────────────────────────────
    (("e2e4","e7e5","g1f3","b8c6","b1c3","g8f6"), "C47", "Four Knights Game", "Perfect symmetry — for now."),

    # ── King's Gambit ───────────────────────────────────────────────────────
    (("e2e4","e7e5","f2f4","e5f4","g1f3"), "C37", "King's Gambit Accepted, King's Knight Gambit", "A romantic sacrifice for rapid development."),
    (("e2e4","e7e5","f2f4","e5f4"), "C33", "King's Gambit Accepted", "White sacrifices a pawn for a blaze of activity."),
    (("e2e4","e7e5","f2f4","e7e5"), "C30", "King's Gambit Declined", "Black refuses the bait."),
    (("e2e4","e7e5","f2f4"), "C30", "King's Gambit", "A bold romantic-era weapon."),

    # ── Sicilian Defense ────────────────────────────────────────────────────
    (("e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4","g8f6","b1c3","a7a6"), "B90", "Sicilian Najdorf", "The most popular opening in top-level chess."),
    (("e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4","g8f6","b1c3","g7g6"), "B78", "Sicilian Dragon", "One of the sharpest and most double-edged lines in all of chess."),
    (("e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4","g8f6","b1c3"), "B70", "Sicilian Dragon setup", "Black prepares the Dragon pawn structure."),
    (("e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4","g8f6"), "B60", "Sicilian, Scheveningen setup", "A flexible and solid Sicilian."),
    (("e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4"), "B54", "Sicilian, Open Variation", "The main line — White opens the centre at once."),
    (("e2e4","c7c5","g1f3","e7e6","d2d4","c5d4","f3d4"), "B40", "Sicilian, Kan Variation", "Black keeps maximum flexibility."),
    (("e2e4","c7c5","g1f3","b8c6","d2d4","c5d4","f3d4"), "B56", "Sicilian, Classical", "The knight takes its natural post."),
    (("e2e4","c7c5","b1c3"), "B23", "Sicilian, Closed", "White avoids the Open Sicilian complexities."),
    (("e2e4","c7c5","g1f3","e7e6"), "B40", "Sicilian Defense, Kan/Taimanov area", "A flexible Sicilian setup."),
    (("e2e4","c7c5","g1f3","d7d6"), "B54", "Sicilian Defense, Open", "The most combative response to 1.e4."),
    (("e2e4","c7c5","g1f3"), "B40", "Sicilian Defense, Open", "White signals the Open Sicilian."),
    (("e2e4","c7c5"), "B20", "Sicilian Defense", "The most popular response to 1.e4 at every level of chess."),

    # ── French Defense ──────────────────────────────────────────────────────
    (("e2e4","e7e6","d2d4","d7d5","b1c3","f8b4"), "C15", "French, Winawer Variation", "An asymmetrical and combative line."),
    (("e2e4","e7e6","d2d4","d7d5","b1c3","g8f6"), "C11", "French Defense, Classical", "The knight takes its natural square."),
    (("e2e4","e7e6","d2d4","d7d5","e4e5"), "C02", "French, Advance Variation", "White grabs space — a patient positional battle awaits."),
    (("e2e4","e7e6","d2d4","d7d5","b1d2"), "C10", "French, Tarrasch Variation", "A solid and methodical approach."),
    (("e2e4","e7e6","d2d4","d7d5"), "C01", "French Defense", "The central tension defines the game."),
    (("e2e4","e7e6"), "C00", "French Defense", "Solid and strategic."),

    # ── Caro-Kann Defense ───────────────────────────────────────────────────
    (("e2e4","c7c6","d2d4","d7d5","b1c3","d5e4","c3e4","g8f6"), "B15", "Caro-Kann, Classical", "A resilient and well-respected defense."),
    (("e2e4","c7c6","d2d4","d7d5","e4e5"), "B12", "Caro-Kann, Advance Variation", "White stakes out central space."),
    (("e2e4","c7c6","d2d4","d7d5"), "B13", "Caro-Kann, Exchange Variation area", "Black strikes back in the centre."),
    (("e2e4","c7c6"), "B10", "Caro-Kann Defense", "Solid and slightly less committal than 1...e5."),

    # ── Scandinavian Defense ────────────────────────────────────────────────
    (("e2e4","d7d5","e4d5","d8d5","b1c3"), "B01", "Scandinavian Defense, Main Line", "The queen comes out early — a provocative choice."),
    (("e2e4","d7d5"), "B01", "Scandinavian Defense", "An early central challenge."),

    # ── Pirc / Modern / Alekhine ────────────────────────────────────────────
    (("e2e4","d7d6","d2d4","g8f6","b1c3","g7g6"), "B07", "Pirc Defense", "Hypermodern — Black lets White build a centre, then attacks it."),
    (("e2e4","g7g6"), "B06", "Modern Defense", "A hypermodern setup with many transpositional options."),
    (("e2e4","g8f6"), "B02", "Alekhine's Defense", "Black invites White to chase the knight and over-extend."),

    # ── King's Pawn generic ─────────────────────────────────────────────────
    (("e2e4","e7e5","g1f3","b8c6"), "C40", "King's Knight Opening", "The most classical of openings."),
    (("e2e4","e7e5","g1f3"), "C40", "King's Knight Opening", "Development with tempo."),
    (("e2e4","e7e5"), "C20", "King's Pawn Opening", "The most classical of starts."),

    # ── Queen's Gambit ──────────────────────────────────────────────────────
    (("d2d4","d7d5","c2c4","e7e6","b1c3","g8f6","c1g5"), "D55", "Queen's Gambit Declined, Classical", "A time-tested solid structure."),
    (("d2d4","d7d5","c2c4","e7e6","b1c3","g8f6"), "D37", "Queen's Gambit Declined", "Black builds a solid central fortress."),
    (("d2d4","d7d5","c2c4","e7e6"), "D30", "Queen's Gambit Declined", "Reliable and principled."),
    (("d2d4","d7d5","c2c4","c7c6","g1f3","g8f6"), "D46", "Slav Defense, Semi-Slav", "A sharp and theoretically rich line."),
    (("d2d4","d7d5","c2c4","c7c6"), "D10", "Slav Defense", "A solid alternative to the Queen's Gambit Declined."),
    (("d2d4","d7d5","c2c4","d5c4"), "D20", "Queen's Gambit Accepted", "Black accepts the pawn and plans …c5."),
    (("d2d4","d7d5","c2c4"), "D06", "Queen's Gambit", "One of the most classical openings in all of chess."),
    (("d2d4","d7d5"), "D00", "Queen's Pawn Opening", "A solid, positional approach."),

    # ── King's Indian Defense ───────────────────────────────────────────────
    (("d2d4","g8f6","c2c4","g7g6","b1c3","f8g7","e2e4","d7d6","g1f3","e8g8"), "E97", "King's Indian Defense, Main Line", "One of Black's sharpest and most fighting responses."),
    (("d2d4","g8f6","c2c4","g7g6","b1c3","f8g7","e2e4","d7d6"), "E76", "King's Indian Defense", "A dynamic counter-attacking setup."),
    (("d2d4","g8f6","c2c4","g7g6","b1c3"), "E60", "King's Indian Defense", "Black prepares the fianchetto."),

    # ── Nimzo / Queen's Indian ──────────────────────────────────────────────
    (("d2d4","g8f6","c2c4","e7e6","b1c3","f8b4"), "E20", "Nimzo-Indian Defense", "Black pins the knight — a classical hypermodern weapon."),
    (("d2d4","g8f6","c2c4","e7e6","g1f3","b7b6"), "E12", "Queen's Indian Defense", "Black fianchettoes the queen's bishop."),

    # ── Grünfeld Defense ────────────────────────────────────────────────────
    (("d2d4","g8f6","c2c4","g7g6","b1c3","d7d5"), "D80", "Grünfeld Defense", "Black invites White to occupy the centre — then attacks it."),

    # ── Benoni / Dutch ──────────────────────────────────────────────────────
    (("d2d4","g8f6","c2c4","c7c5","d4d5"), "A60", "Benoni Defense", "An imbalanced, counter-attacking structure."),
    (("d2d4","f7f5"), "A80", "Dutch Defense", "Black fights for e4 from the very first move."),

    # ── London System ───────────────────────────────────────────────────────
    (("d2d4","d7d5","g1f3","g8f6","c1f4"), "D02", "London System", "Solid, reliable, and endlessly repayable."),

    # ── English Opening ─────────────────────────────────────────────────────
    (("c2c4","e7e5","b1c3","g8f6","g1f3","b8c6"), "A25", "English Opening, Closed", "A reversed Sicilian with an extra tempo."),
    (("c2c4","e7e5"), "A20", "English Opening, King's English", "A reversed Sicilian position."),
    (("c2c4","c7c5","g1f3","g8f6"), "A30", "English Opening, Symmetrical", "Perfect pawn symmetry — for now."),
    (("c2c4","c7c5"), "A30", "English Opening, Symmetrical", "Both sides mirror each other's strategy."),
    (("c2c4",), "A10", "English Opening", "A flexible hypermodern first move."),

    # ── Réti Opening ────────────────────────────────────────────────────────
    (("g1f3","d7d5","c2c4","d5c4"), "A09", "Réti Opening, Accepted", "Black takes the pawn; tension follows."),
    (("g1f3","d7d5","c2c4"), "A09", "Réti Opening", "A hypermodern classic."),
    (("g1f3",), "A04", "Réti Opening", "White develops flexibly, delaying pawn commitments."),
]

# Pre-sort longest-first so the first match is always the most specific line.
_OPENINGS_SORTED = sorted(_OPENINGS, key=lambda x: len(x[0]), reverse=True)


def recognize_opening() -> dict:
    """Identify the chess opening being played from the current move history.

    Call this once after moves 3–6 to identify the opening and comment
    on it naturally. Do not call it before move 3 or after move 10 —
    the opening phase will be over.

    Returns:
        A dict with 'found' (bool), 'name', 'eco', 'description', and
        'moves_matched'. If fewer than 3 moves have been played or the
        opening is not in the book, 'found' is False.
    """
    state = game_state.get_state()
    history = state["move_history"]

    if len(history) < 3:
        return {
            "found": False,
            "name": "Too early to tell",
            "eco": "",
            "description": "",
            "moves_matched": 0,
        }

    played = tuple(entry["move_uci"] for entry in history)

    for entry_moves, eco, name, description in _OPENINGS_SORTED:
        depth = len(entry_moves)
        if depth <= len(played) and played[:depth] == entry_moves:
            return {
                "found": True,
                "name": name,
                "eco": eco,
                "description": description,
                "moves_matched": depth,
            }

    return {
        "found": False,
        "name": "Unknown opening",
        "eco": "",
        "description": "An unusual or less common line.",
        "moves_matched": 0,
    }
