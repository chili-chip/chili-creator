---
title: Bee Home tutorial
description: Build Bee Home, a small Chili Beat game, from a blank game in the creator.
---

# Bee Home tutorial

In Bee Home you are a bee. Visit flowers to collect pollen while a wasp chases
you, and bring 5 pollen home to win. It takes about 20 minutes and uses every
Chili Beat tool.

![Bee Home in Play](../../assets/screenshots/beat-play.png){ .shot }

The finished game is a template: **New game** › Chili Beat › **Bee Home**.
Open it next to yours if you get stuck.

## 1. Start a blank game

1. Open the creator.
2. In **Projects**, press **New game**, then **Chili Beat**.
3. Type **Bee Home** as the title, at the top.

The game has a hero (`@`) in a walled room, and one card: *When you press an
arrow, you move that way.* Press **Play game** in **Play** and walk around.

## 2. Colours and the counter

Open **Game**.

1. Pick the colours: click colour 1 and then the green (6), colour 2 and the
   yellow (4), colour 3 and the white (12). Keep colour 0, the dark blue.
2. Press **Add counter**. Name it **Pollen**. You will set its icon in step 3.

## 3. Draw the things

Open **Things**.

1. Click the hero. Rename it **Bee**, keep **Is you** on, and draw a bee: yellow
   stripes and white wings. Press **Add frame 2** and move the wings, so it
   flaps on the beat.
2. Click the wall. Rename it **Hedge** and draw it green.
3. Press **Add** for each of these, and draw them:

    | Name | Looks like |
    |---|---|
    | Flower | A yellow flower on a green stem |
    | Bud | Just the stem |
    | Hive | A yellow dome |
    | Wasp | Like the bee, with white and yellow |

4. Back in **Game**, set the Pollen counter's icon to **Flower**.

## 4. Paint the meadow

Open **Screens**. Pick a brush, then click or drag on the board.

1. Paint hedges inside the room, to make paths.
2. Paint 6 or 7 flowers, the hive near the bee, and one wasp far away.

## 5. The rules

Open **Rules**. The arrow card is already there. Press **Add rule** for each of
the cards below, then set its parts from the lists.

| # | When | If | Then |
|---|---|---|---|
| 2 | Bee **bumps** Flower | | **the bumped** become Bud · **count** Pollen goes up by 1 |
| 3 | **every few beats** 8, Bud | | **it** become Flower |
| 4 | **every few beats** 2, Wasp | | **it** move toward you |
| 5 | Wasp **bumps** Bee | | shake · lose "Stung! Try again." |
| 6 | Bee **bumps** Hive | Pollen is at least 5 | win "The hive is happy." |
| 7 | Bee **bumps** Hive | Pollen is at most 4 | say "Bring me 5 pollen." |

Use **+ If counter** to add the condition, and **+ Action** for a second
action. Hedges need no card: a thing with no bump card acts as a wall.

!!! tip "Why the bee doesn't fly into the flower"
    After a bump, the bumper moves in only if the cell is empty. The flower
    *becomes* a bud and stays, so the bee stays where it is. That is how you
    "visit" a flower without eating it.

## 6. Sound

Open **Sounds**.

1. **Add sound**, rename it **coin** and pick the **coin** preset. Press ▶.
2. In card 2, press **+ Action** and choose **play sound** › **coin**.
3. **Add tune**. Pick **Pentatonic major** and click a few notes and a kick on
   step 1. Press **Play tune**.
4. In **Screens**, set the screen's **Tune** to it.

## 7. Play and check

1. Open **Problems**. It should say **No problems found**.
2. In **Play**, press **Play game**. Visit flowers, wait for buds to grow back,
   and keep away from the wasp. Watch the cards light up in **Rules**.
3. Bring 5 pollen to the hive. Press A after you win to play again.

## Ideas to try next

- Add a recipe: **Door and key** for a locked garden, or **Timer** to race the clock.
- Add a second screen on the map, and leave a gap in the hedge to walk there.
- Switch **Game** to **In turns** and see how the wasp waits for you.
