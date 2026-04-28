import sys

import morfeusz2


NOUN_TAGS = {"subst", "depr"}


def normalize_lemma(lemma):
    return lemma.split(":", 1)[0].lower()


def get_noun_lemmas(morfeusz, word):
    lemmas = set()

    for start, end, interpretation in morfeusz.analyse(word):
        if start != 0 or end != 1:
            continue

        tag = interpretation[2]
        if tag.split(":", 1)[0] in NOUN_TAGS:
            lemmas.add(normalize_lemma(interpretation[1]))

    return lemmas


def main():
    morfeusz = morfeusz2.Morfeusz()
    input_stream = sys.stdin.buffer
    output_stream = sys.stdout.buffer

    for raw_line in input_stream:
        word = raw_line.decode("utf-8").strip()

        for lemma in sorted(get_noun_lemmas(morfeusz, word)):
            output_stream.write(f"{lemma}\n".encode("utf-8"))


if __name__ == "__main__":
    main()
