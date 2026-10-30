---
title: "4. Dialog"
description: Make the gardener ask for his chilis, and say thank you and hand over the key once the player has all three.
---

# 4. Dialog

**Dialog** is what sprites and items say. It can be plain text, or a small script that changes with what the player has done. In this step the gardener asks for his chilis, and gives you the key when you bring all three.

## Write plain text first

1. Pick the gardener in [Library](../tools/library.md) and open [Dialog](../tools/dialog.md). It shows his dialog, *cat dialog*, with *Said by gardener* above it.
2. Rename it `gardener dialog`.
3. Replace the text with `Hello! I lost my chilis somewhere in the garden.`

Long text is split into pages for you. The player presses a button to go on. Start a new page yourself with `{pg}`, or **Insert… → New page**.

## Build it from blocks

Choose **Blocks** at the top of Dialog. The same dialog shows as blocks you add, move and remove with buttons, no typing of code.

![Dialog in Blocks view: an If block checks the chili count, with text, a wavy effect, a new page, Set how many of an item and Set a variable inside](../../../assets/screenshots/dialog-blocks.png){ .shot }

Make the gardener answer two ways:

1. Add **If the player has an item**. It checks an item count and has two branches: one when the check is true, and **else**.
2. In the check, pick **chili** and change `>= 1` to `>= 3`.
3. In the first branch, add **Text**: `Wonderful, all three chilis!` Then **New page**, then **Text**: `Take this key. The shed is through the gate.`
4. Still in the first branch, add **Set how many of an item**: **key** to **1**. This gives the player the key.
5. In **else**, add **Say lines in order** with two lines:
    - `Hello! I lost my chilis somewhere in the garden.`
    - `Can you find all 3 for me?`

    The first time you talk he says the first line; every time after, the second.

## The same dialog as text

Switch back to **Text** to see the script behind the blocks. Both views edit the same dialog, so use whichever you like.

![Dialog in Text view showing the gardener's script](../../../assets/screenshots/tool-dialog.png){ .shot }

```text
{
  - {item "0"} >= 3 ?
    {wvy}Wonderful{wvy}, all three chilis!{pg}Take this key. The shed is through the gate.{item "1" 1}
  - else ?
    {sequence
      - Hello! I lost my chilis somewhere in the garden.
      - Can you find all 3 for me?
    }
}
```

`{wvy}…{wvy}` makes *Wonderful* wavy: add it with **Insert… → Wavy text**. Every command is explained in [Dialog scripting](../dialog-scripting.md).

!!! warning "Problems show under the dialog"
    If a script refers to something that does not exist, like an item you deleted, Dialog lists the problem under the text in amber. The [Problems](../tools/problems.md) tool lists them for the whole game.

## Check it

Play the game. Talk to the gardener, collect the chilis, and talk to him again. The **Inventory** under the game shows **key 1** after he thanks you.

![The game screen with the gardener's first line](../../../assets/screenshots/game-gardener.png){ .pixel }

## Next

[5. Exits and endings](5-exits-and-endings.md): the shed behind the gate.
