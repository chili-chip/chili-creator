---
title: Problems
description: The Problems tool. Things that would stop your game working as you meant, each with a link to fix it.
---

# Problems

**Problems** checks the whole game as you work and lists anything that would stop it working as you meant. Click a problem to jump to where you fix it.

![Problems: 1 error, 1 warning. garden has item 7, which does not exist. The ending at 8,4 in shed has no text.](../assets/screenshots/tool-problems.png){ .shot }

The footer always shows the count, or **No problems**. With none, the tool says *No problems found.*

## Errors and warnings

**Errors** (red) break the game: it may not start, or something will be missing. **Warnings** (amber) are probably not what you meant.

| Problem | Kind | Fix |
|---|---|---|
| The game has no avatar (sprite A) | Error | Import a game that has one, or undo |
| The avatar is not in any room | Error | Pick the avatar and click a cell in [Room](room.md) |
| *Room* uses palette …, which does not exist | Error | Pick a palette in [Colors](colors.md) |
| *Room* has tile / item …, which does not exist | Error | Erase the cell in Room |
| *Exit* leads to room …, which does not exist | Error | Set **Leads to** in [Exits & endings](exits.md) |
| *Exit* leads off the room | Error | Set the arrival x and y between 0 and 15 |
| *Sprite* uses dialog / stands in room …, which does not exist | Error | Give it new dialog, or move it |
| *Dialog* exits to room "…", which does not exist | Error | Fix the room in the dialog's **Go to a room** |
| The game has no title | Warning | Type one in the top bar |
| The ending at x,y in *room* has no text | Warning | Write it in Exits & endings |
| *Room* plays tune …, *Sprite* makes blip …, which does not exist | Warning | Pick another in Room or Paint |
| *Dialog* checks item "…", which does not exist | Warning | Pick an item in the If block |
| *Dialog* reads …, a variable that is never set | Warning | Make it in [Variables](variables.md) or set it in dialog |
| Players cannot finish this game yet: add an ending | Warning | Add an ending, or `{end}` in dialog |

Most of these come from importing games or deleting things other parts still use. The creator asks before a delete that leaves things behind.

## Related

- [7. Test and release](../tutorial/7-test-and-release.md)
- [Play](play.md)
