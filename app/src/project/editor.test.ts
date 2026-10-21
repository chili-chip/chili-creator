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
