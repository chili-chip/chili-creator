---
title: Play on VGC Zero
description: Put a game from the Chili Creator on the VGC Zero handheld. Copy the .bitsy file to the CHILICHIP drive and play it from the home screen.
---

# Play on VGC Zero

The VGC Zero plays `.bitsy` games with **citsy**, the same engine the creator uses in [Play](../tools/play.md). A game that plays in the creator plays on the console.

```mermaid
flowchart LR
  Creator -- Download .bitsy --> File[game.bitsy]
  File -- copy --> Drive[CHILICHIP drive<br>bitsy-games/]
  Drive --> Home[Home screen card]
  Home -- A --> citsy
```

## Put a game on the console

1. In the creator, open [Download](../tools/download.md) and choose **Download .bitsy**.
2. Turn the console on and wait for the home screen.
3. Plug it into your computer with a USB cable. A drive named **CHILICHIP** appears.
4. Copy the `.bitsy` file into the `bitsy-games` folder on the drive. Any folder at the top of the drive, or the top of the drive itself, works too.
5. Eject the drive.

The game shows on the home screen as a card with its file name. Pick it and press **A**.

!!! tip "Copy files while the home screen shows"
    While a game runs, the drive is read-only to your computer. Go back to the home screen first.

!!! note "citsy must be installed"
    citsy comes on the console. If no game cards show up, install it: download `citsy-32blit.blit` from the [citsy-32blit releases](https://github.com/chili-chip/citsy-32blit/releases), copy it to the top of the CHILICHIP drive and eject. It shows as **Bitsy** under **Settings → Installed software**, not on the home screen.

## Buttons

| Button | In a game |
|---|---|
| D-pad | Walk |
| **A** | Talk, next page of dialog, choose |
| **B** | Back, cancel |
| **MENU** | Pause: **Resume**, **Restart**, **Exit** |
| **HOME** | System menu: volume and brightness. Hold it to go home. |

**Exit** in the pause menu goes back to the home screen. After an ending, the next button press starts the game again from its title, as in Bitsy.

## What looks different

The console has a 128×128 screen, the same size as a Bitsy room. Dialog uses a box of three lines, so text can break into pages at other places than in the Bitsy editor. See [Differences from Bitsy](differences.md).

## More

- [citsy-32blit](https://github.com/chili-chip/citsy-32blit): the console player, with build steps
- [citsy](https://github.com/chili-chip/citsy): the engine
