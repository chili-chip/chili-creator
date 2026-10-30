import { Box } from 'lucide-react';
import { createElement } from 'react';
import type { EngineModule } from './types';

/** A tiny engine for tests: a game is "FAKE" and a title line. */
export const fakeEngine: EngineModule<{ title: string }> = {
  id: 'fake',
  title: 'Fake',
  description: 'A test engine.',
  icon: Box,
  format: {
    extension: '.fake',
    detect: (text) => text.startsWith('FAKE\n'),
    parse: (text) => ({ doc: { title: text.split('\n')[1] ?? '' }, issues: [] }),
    serialize: (doc) => `FAKE\n${doc.title}`,
  },
  newGame: (title) => `FAKE\n${title}`,
  gameTitle: (doc) => doc.title,
  setTitle(doc, title) {
    doc.title = title;
  },
  check: (doc) => (doc.title ? [] : [{ severity: 'warning', message: 'No title.' }]),
  editors: [
    {
      id: 'fake',
      title: 'Fake editor',
      tools: [
        {
          id: 'fake-tool',
          title: 'Fake tool',
          icon: Box,
          component: () => createElement('p', null, 'The fake tool'),
          openByDefault: true,
        },
      ],
    },
  ],
};
