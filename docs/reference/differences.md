---
title: Differences from Bitsy
description: What the Chili Creator and the citsy engine do differently from the Bitsy editor and the Bitsy web engine.
---

# Differences from Bitsy

Games you make in the Chili Creator are ordinary Bitsy games. You can open them in the [Bitsy editor](https://make.bitsy.org), and the creator imports games made there. This page lists the few places where things differ.

## The engine: citsy

The creator, the platform's **Play** page, exported web pages and VGC Zero all run your game with [citsy](https://github.com/chili-chip/citsy). citsy is a port of the Bitsy 8.15 engine to C++. Its parity tests play the same games in Bitsy and in citsy and check that they match.

| | Bitsy | citsy |
|---|---|---|
| Dialog box | 2 lines | 3 lines, 104×32 pixels |
| Page breaks | Wherever the 2 lines are full | Wherever the 3 lines are full, and citsy keeps a sentence on one screen when it can |
| Text size | Low or high resolution, from the game settings | The same on the web. On VGC Zero text is always low resolution. |
| `unicode_asian` font | Supported | Not supported. The game uses `ascii_small` instead. |

The words, the line breaks and the page breaks you write yourself (`{pg}`, `{br}`) are the same in both.

!!! tip
    Play your game in the creator before you release it. What you see in [Play](../tools/play.md) is what players see.

## The editor

The creator is a new editor. It reads and writes the same `.bitsy` format, and keeps parts of a file it does not change byte for byte.

| | Bitsy editor | Chili Creator |
|---|---|---|
| Where games live | In the browser, or a file you download | On your Chili account, or in the browser when you are not signed in |
| Layout | Fixed panels | Panels you move, with [layout presets](../get-started/workspace.md), and a one-tool view on [phones](../get-started/phone.md) |
| Dialog | Blocks or script | Text with an **Insert** menu, or blocks, see [Dialog](../tools/dialog.md) |
| Checks | None | [Problems](../tools/problems.md) finds broken exits, missing rooms, unset variables and more |
| Releasing | Export a web page | [Release](../tools/projects.md#release-a-game) on Chili Platform, or [download](../tools/download.md) a web page |

## Related

- [Dialog scripting](dialog-scripting.md)
- [citsy dialog notes](https://github.com/chili-chip/citsy/blob/main/docs/bitsy/dialog.md) for the exact paging rules
