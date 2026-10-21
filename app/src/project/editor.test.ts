import { describe, expect, it, vi } from 'vitest';
import { createWorld } from '../bitsy';
import { createEditorState, resolveSelection } from './editor';

const world = () => createWorld({ title: 'Test' });

describe('createEditorState', () => {
  it("starts on the avatar's room with the avatar picked", () => {
    const editor = createEditorState();
    const w = world();
    w.rooms.unshift({ ...structuredClone(w.rooms[0]!), id: '5' });
    editor.reset(w);
    expect(editor.getState()).toMatchObject({
      room: '0',
      drawing: { kind: 'sprites', id: 'A' },
      frame: 0,
      roomTool: 'place',
      paintTool: 'pencil',
      libraryTab: 'sprites',
    });
  });

  it('picks a drawing and shows its kind in the library', () => {
    const editor = createEditorState();
    editor.reset(world());
    editor.set({ frame: 1 });
    editor.select({ kind: 'tiles', id: 'a' });
    expect(editor.getState()).toMatchObject({ drawing: { kind: 'tiles', id: 'a' }, libraryTab: 'tiles', frame: 0 });
  });

  it('lets the dialog follow the picked drawing again when a drawing is picked', () => {
    const editor = createEditorState();
    editor.set({ dialog: '2' });
    editor.select({ kind: 'sprites', id: 'a' });
    expect(editor.getState().dialog).toBeNull();
  });

  it('goes to a place in the game and says which tool shows it', () => {
    const editor = createEditorState();
    editor.reset(world());
    expect(editor.goTo({ type: 'room', room: '0', x: 3, y: 4 })).toBe('room');
    expect(editor.getState()).toMatchObject({ room: '0', marker: { x: 3, y: 4 } });
    expect(editor.goTo({ type: 'drawing', kind: 'items', id: '1' })).toBe('paint');
    expect(editor.getState().drawing).toEqual({ kind: 'items', id: '1' });
    expect(editor.goTo({ type: 'dialog', id: '2' })).toBe('dialog');
    expect(editor.getState().dialog).toBe('2');
    expect(editor.goTo({ type: 'variable', id: 'a' })).toBe('variables');
    expect(editor.goTo({ type: 'palette', id: '0' })).toBe('colors');
    expect(editor.goTo({ type: 'game' })).toBe('game');
    expect(editor.goTo({ type: 'tune', id: '2' })).toBe('tunes');
    expect(editor.getState().tune).toBe('2');
    expect(editor.goTo({ type: 'blip', id: '1' })).toBe('blips');
    expect(editor.getState().blip).toBe('1');
  });

  it('tells subscribers about changes', () => {
    const editor = createEditorState();
    const listener = vi.fn();
    const stop = editor.subscribe(listener);
    editor.set({ roomTool: 'erase' });
    stop();
    editor.set({ roomTool: 'place' });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('resolveSelection', () => {
  it('finds the dialog: the one picked, else the picked drawing’s', () => {
    const w = world();
    const editor = createEditorState();
    editor.reset(w);
    expect(resolveSelection(w, editor.getState()).dialog).toBeUndefined();
    editor.select({ kind: 'sprites', id: 'a' });
    expect(resolveSelection(w, editor.getState()).dialog?.id).toBe('0');
    editor.set({ dialog: '1' });
    expect(resolveSelection(w, editor.getState()).dialog?.id).toBe('1');
    editor.set({ dialog: 'gone' });
    expect(resolveSelection(w, editor.getState()).dialog?.id).toBe('0');
  });

  it('finds the exit or ending at the marker in the room', () => {
    const w = world();
    w.rooms[0]!.exits.push({ x: 3, y: 4, dest: { room: '0', x: 1, y: 1 } });
    w.rooms[0]!.endings.push({ id: '2', x: 5, y: 5 });
    const editor = createEditorState();
    editor.reset(w);
    editor.set({ marker: { x: 3, y: 4 } });
    expect(resolveSelection(w, editor.getState()).marker).toEqual({ x: 3, y: 4, exit: 0 });
    editor.set({ marker: { x: 5, y: 5 } });
    expect(resolveSelection(w, editor.getState()).marker).toEqual({ x: 5, y: 5, ending: '2' });
    editor.set({ marker: { x: 9, y: 9 } });
    expect(resolveSelection(w, editor.getState()).marker).toBeUndefined();
  });

  it('finds the picked room and drawing', () => {
    const w = world();
    const editor = createEditorState();
    editor.reset(w);
    const found = resolveSelection(w, editor.getState());
    expect(found.room?.id).toBe('0');
    expect(found.drawing?.id).toBe('A');
    expect(found.kind).toBe('sprites');
    expect(found.frame).toBe(0);
  });

  it('falls back when what was picked is gone (after an undo, say)', () => {
    const w = world();
    const editor = createEditorState();
    editor.set({ room: '9', drawing: { kind: 'tiles', id: 'zz' }, frame: 1 });
    const found = resolveSelection(w, editor.getState());
    expect(found.room?.id).toBe('0');
    expect(found.drawing).toBeUndefined();
    expect(found.frame).toBe(0);
  });

  it('shows the last frame when the picked one is gone', () => {
    const w = world();
    w.sprites[0]!.frames.push(Array(64).fill(1));
    const found = resolveSelection(w, { ...createEditorState().getState(), drawing: { kind: 'sprites', id: 'A' }, frame: 1 });
    expect(found.frame).toBe(1);
    w.sprites[0]!.frames.pop();
    expect(resolveSelection(w, { ...createEditorState().getState(), drawing: { kind: 'sprites', id: 'A' }, frame: 1 }).frame).toBe(0);
  });
});
