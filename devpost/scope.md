---
doc: scope
status: approved
---

# Lotería for Teachers (working title)

An AI tool that turns any class topic into a ready-to-print Lotería: illustrated cards, boards for the whole class, and an on-screen caller.

## The Unique Kernel
The teacher only types a topic and picks a language; the app creates the whole Lotería automatically — a picture and a name for every concept — plus boards to print. The class then plays the way Lotería has always been played, on paper, marking squares by hand, and remembers the concepts of the subject while playing.

## Who It's For
A teacher who wants the class to remember the concepts of a subject. Cristian first pictures a teacher in Mexico: an English teacher (vocabulary), or a physics or chemistry teacher with concepts like "the atom" and "the particle." For the demo, a science teacher and the solar system. He first picked math, then switched once he saw that math drawings have to be exact. It should work for any subject.

What they do today instead: not discussed yet.

## The Core Loop
1. The teacher types the topic of the lesson and picks the language for the cards.
2. The app creates the whole Lotería automatically, with a picture and a name on each card.
3. The teacher says how many boards the class needs, and the boards come out ready to print.
4. The teacher calls the cards, either printed or on screen: scroll up for the next card, scroll down to go back to the previous one. The teacher shouts each card's name; students look for the card with that picture and name on their board.

Why they come back: every new topic is a new game. Cristian chose teachers because "they could use it more often," while in Mexico a board game is something "you buy, play once, and put away for life" (translated from Spanish).

## Inspiration & Identity
Traditional Mexican Lotería: a caller shouts the cards and players mark their paper boards by hand. The fun is physical. In Cristian's words, having the cards in hand and filling the squares yourself is "the kind of experience families look for when they want to get away from their phones."

The cards should look like classic Lotería cards: a picture with its name printed on the card, "like the normal Lotería that has the picture and the name." He shared a photo of classic cards (El Pájaro, La Mano, La Luna…) as the reference.

## Why This Matters to the Learner
He wants to make something people use again and again, not something bought once and put away, which is why he aimed it at teachers. He also wants to keep what makes Lotería fun: playing with your hands, away from phones.

## What "Working" Looks Like
A one-minute demo:
1. A teacher types "the solar system" and picks a language.
2. A complete Lotería appears, with a picture and a name on every card.
3. The teacher picks how many boards and gets them ready to print.
4. The teacher calls the cards on screen, scrolling up for the next card and down to go back.

The "oh, that's cool" moment: a whole illustrated Lotería appears from a single topic.

## The POC Boundary
- Type a topic and choose the card language from the most common teaching languages.
- The app creates the deck automatically: a picture and a name for each concept.
- Choose how many boards, and print them.
- Print the cards, or call them on screen (scroll up: next card; scroll down: previous card).

## Later
- Families playing at home. Teachers come first; families can benefit indirectly.

## Explicitly Cut
- **Students playing on phones or screens.** The fun is physical: paper boards, marked by hand, away from phones.
- **Calling out clues or definitions instead of the card's name.** The teacher shouts the name, as in classic Lotería, and students find the matching picture and name.

## Open Questions and Risks
- **Pictures must be right** (agent's note). AI image generators often get shapes, numbers, and written text wrong; in math, for example, a pentagon needs five sides. That's why the demo uses the solar system instead of math. The plan so far: the app prints each card's name itself and the drawing has no letters, so names are always spelled right and switch with the language. `4-spec` decides how to keep the drawings reliable for whatever topic a teacher types.
- **Which languages** count as "the most common for teaching." To be settled in `3-prd`.
