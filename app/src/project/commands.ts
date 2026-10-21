import type { CommandDefinition } from '../plugin-api';
import type { EditorStore } from './editor';
import type { ProjectStore } from './store';

/** Undo, redo and the editing tools' modes, with their keys. */
export function editingCommands({ projects, editor }: { projects: ProjectStore; editor: EditorStore }): CommandDefinition[] {
  const history = () => projects.getState().history;
  return [
    {
      id: 'edit.undo',
      title: 'Undo',
      category: 'Edit',
      keybinding: 'mod+z',
      enabled: () => history().canUndo,
      run: () => void projects.undo(),
    },
    {
      id: 'edit.redo',
      title: 'Redo',
      category: 'Edit',
      keybinding: ['mod+shift+z', 'mod+y'],
      enabled: () => history().canRedo,
      run: () => void projects.redo(),
    },
    { id: 'paint.pencil', title: 'Pencil', category: 'Paint', keybinding: 'b', run: () => editor.set({ paintTool: 'pencil' }) },
    { id: 'paint.fill', title: 'Fill', category: 'Paint', keybinding: 'f', run: () => editor.set({ paintTool: 'fill' }) },
    { id: 'room.place', title: 'Place', category: 'Room', keybinding: 'p', run: () => editor.set({ roomTool: 'place' }) },
    { id: 'room.erase', title: 'Erase', category: 'Room', keybinding: 'e', run: () => editor.set({ roomTool: 'erase' }) },
    { id: 'room.pick', title: 'Pick what is on a cell', category: 'Room', keybinding: 'i', run: () => editor.set({ roomTool: 'pick' }) },
    { id: 'room.exit', title: 'Add exits', category: 'Room', keybinding: 'x', run: () => editor.set({ roomTool: 'exit' }) },
    { id: 'room.ending', title: 'Add endings', category: 'Room', keybinding: 'n', run: () => editor.set({ roomTool: 'ending' }) },
  ];
}
