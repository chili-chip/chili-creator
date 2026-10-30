import type { LucideIcon } from 'lucide-react';
import type { ToolDefinition } from '../plugin-api';

/** Something wrong in a game, for the Problems tool and the count in the footer. */
export interface EngineProblem {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** A set of tools for making games of one engine. */
export interface EditorDefinition {
  id: string;
  title: string;
  tools: ToolDefinition[];
}

/**
 * One kind of game the creator can make: its file format, editors and checks.
 * The shell only knows this type. It never imports an engine's folder.
 */
export interface EngineModule<Doc = unknown> {
  /** Saved with every project. Never changes. */
  id: string;
  title: string;
  /** One line for the New game picker. */
  description: string;
  icon: LucideIcon;
  format: {
    extension: string;
    detect(text: string): boolean;
    parse(text: string): { doc: Doc; issues: { message: string }[] };
    serialize(doc: Doc): string;
  };
  /** The text of a new, blank game. */
  newGame(title: string): string;
  /** Example games to start from, offered next to a blank one. */
  templates?: { title: string; make(title: string): string }[];
  /** The game's title, for project lists. */
  gameTitle(doc: Doc): string;
  setTitle(doc: Doc, title: string): void;
  check(doc: Doc): EngineProblem[];
  /** The first one is the default. */
  editors: EditorDefinition[];
}
