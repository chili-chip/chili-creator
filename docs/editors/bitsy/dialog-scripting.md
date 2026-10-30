---
title: Dialog scripting
description: The Bitsy dialog language in the Chili Creator. Pages, text effects, lists, conditions, items, variables, room and sound actions, with examples.
---

# Dialog scripting

Dialog is text with commands in curly braces. The **Blocks** view and the **Insert…** menu in [Dialog](tools/dialog.md) write every command here for you, so you only need this page to read or tweak a script by hand.

The language is Bitsy's. Games play the same in the creator, on the platform and on VGC Zero, because [citsy](https://github.com/chili-chip/citsy) runs a port of Bitsy 8.15's own script interpreter.

## Pages and lines

| Write | Result |
|---|---|
| Plain text | Typed out letter by letter in the text box |
| Text longer than the box | More screens: the player presses a button to go on |
| `{pg}`, or an empty line | A new page |
| `{br}` | A new line |

The text box holds three lines. citsy keeps a sentence together on one screen when it fits.

## Text effects

Each tag switches an effect on; the same tag again switches it off. Effects combine.

| Tag | Block | Effect |
|---|---|---|
| `{wvy}…{wvy}` | Wavy text | Letters bob up and down |
| `{shk}…{shk}` | Shaky text | Letters shake |
| `{rbw}…{rbw}` | Rainbow text | Letters cycle through ten colours |
| `{clr1}…{clr1}` | Colour 1 text | The room's background colour |
| `{clr2}…{clr2}` | Colour 2 text | The room's tile colour |
| `{clr3}…{clr3}` | Colour 3 text | The room's sprite and item colour |

```text
I have a {wvy}secret{wvy} for you.
```

## Lists

A list picks one option each time the dialog runs. Every option is a line starting with `-`.

| List | Block | Picks |
|---|---|---|
| `{sequence …}` | Say lines in order | The next option each time, then stays on the last |
| `{cycle …}` | Say lines round and round | The next option each time, then back to the first |
| `{shuffle …}` | Say lines in any order | A random option, no repeats until all were used |

```text
{sequence
  - Hello, traveller.
  - Back again?
  - You again!
}
```

## Conditions

A bare `{` makes a branch: the first option whose condition is true runs, and `else` runs when none is.

```text
{
  - {item "0"} >= 3 ?
    All three chilis!
  - thanked == 1 ?
    Thanks again.
  - else ?
    Can you find my chilis?
}
```

Blocks: **If the player has an item** and **If a variable is…**.

| Compare | Means |
|---|---|
| `==` | equal |
| `>=`, `<=` | at least, at most |
| `>`, `<` | more than, less than |

Lists and branches can sit inside each other, and an option can hold actions as well as text.

## Items

Write items by id (`"0"`) or by name (`"chili"`). The blocks use ids.

| Script | Block | Does |
|---|---|---|
| `{item "0"}` | (in a condition) | How many the avatar carries |
| `{say {item "0"}}` | Show how many of an item | Prints the count |
| `{item "1" 1}` | Set how many of an item | Sets the count, never below 0 |
| `{item "0" {{item "0"} + 1}}` | One more of an item | Adds one |
| `{item "0" {{item "0"} - 1}}` | One less of an item | Takes one away |

## Variables

Make variables in [Variables](tools/variables.md).

| Script | Block | Does |
|---|---|---|
| `{score = 5}` | Set a variable | Sets it |
| `{score = score + 1}` | Change a variable | Changes it with `+ - * /` |
| `{say score}` | Show a variable | Prints it |
| `{mood = "happy"}` | | Words go in quotes |

!!! warning "Bitsy's maths"
    Bitsy reads a sum from the first operator, in the order `== >= <= > < - + / *`. So `{a = 10 - 3 + 2}` is `10 - (3 + 2)`, which is 5. Use one operator per assignment to stay safe.

## Room actions

| Script | Block | Does |
|---|---|---|
| `{exit "1" 8 14}` | Go to a room | Moves the avatar to room 1, cell 8,14 now |
| `{end}` | End the game | Ends the game after this dialog |
| `{property locked true}` | Lock or unlock the exit | In an exit's or ending's dialog: keeps the avatar out. `false` lets it through. |
| `{pal "1"}` | Change the palette | Switches the room to palette 1 |
| `{ava "a"}` | Change the avatar | Draws the avatar as sprite `a` |

## Sound actions

| Script | Block | Does |
|---|---|---|
| `{blip "1"}` | Play a blip | Plays blip 1 now |
| `{tune "2"}` | Play a tune | Plays tune 2. `{tune "0"}` stops the music. |

## Drawings in the text

| Script | Block | Draws |
|---|---|---|
| `{drwt "a"}` | Draw a tile | Tile `a` inside the text |
| `{drws "A"}` | Draw a sprite | A sprite, the avatar too |
| `{drwi "0"}` | Draw an item | An item |

## In the .bitsy file

A dialog with more than one line is wrapped in `"""` in the file. The creator does this for you. If you edit the file by hand, keep them, or the dialog shows nothing:

```text
DLG 1
"""
{
  - {item "0"} >= 3 ?
    All three chilis!
  - else ?
    Can you find my chilis?
}
"""
NAME gardener dialog
```

## More

- citsy's [dialog reference](https://github.com/chili-chip/citsy/blob/main/docs/bitsy/dialog.md) has every detail, down to timing.
- The [Bitsy docs](https://make.bitsy.org/docs/) explain the same language for the Bitsy editor.
