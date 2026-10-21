import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addEnding } from '../../bitsy';
import { renderTool } from '../../test/creator';
import problems from '.';

const Problems = problems.component;

describe('Problems', () => {
  it('lists what is wrong with the game and goes to it', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Problems);
    act(() =>
      creator.projects.updateWorld((w) => {
        w.sprites.find((s) => s.id === 'a')!.dialog = 'gone';
      }),
    );
    expect(screen.getByText('1 error, 1 warning')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cat uses dialog gone/ }));
    expect(creator.editor.getState().drawing).toEqual({ kind: 'sprites', id: 'a' });
  });

  it('says when nothing is wrong', async () => {
    const { creator } = await renderTool(Problems);
    act(() => creator.projects.updateWorld((w) => void addEnding(w, '0', 5, 5)));
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
  });
});
