/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// محرر CodeMirror 6 المحلي وسمته المشتركة (اللوحة الجانبية، محرر المهارات).
import { state } from './core.js';

let CM = null;
export async function cm() {
  if (!CM) CM = await import(`/vendor/codemirror/codemirror.min.mjs?v=${encodeURIComponent(state.info?.version || '')}`);
  return CM;
}
export function themeExt(C) {
  const hl = C.HighlightStyle.define([
    { tag: [C.tags.keyword, C.tags.controlKeyword, C.tags.moduleKeyword, C.tags.operatorKeyword], color: 'var(--syntax-keyword)' },
    { tag: [C.tags.string, C.tags.special(C.tags.string), C.tags.regexp], color: 'var(--syntax-string)' },
    { tag: [C.tags.number, C.tags.bool, C.tags.null, C.tags.atom], color: 'var(--syntax-number)' },
    { tag: [C.tags.comment, C.tags.lineComment, C.tags.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: [C.tags.function(C.tags.variableName), C.tags.function(C.tags.propertyName)], color: 'var(--secondary-text)' },
    { tag: [C.tags.typeName, C.tags.className, C.tags.tagName], color: 'var(--accent-text)' },
    { tag: [C.tags.attributeName, C.tags.propertyName], color: 'var(--copper-light)' },
    { tag: C.tags.heading, color: 'var(--accent-text)', fontWeight: '700' },
    { tag: C.tags.strong, fontWeight: '700' }, { tag: C.tags.emphasis, fontStyle: 'italic' },
    { tag: [C.tags.link, C.tags.url], color: 'var(--secondary-text)' },
    { tag: [C.tags.quote, C.tags.processingInstruction, C.tags.meta], color: 'var(--text-muted)' },
    { tag: C.tags.monospace, color: 'var(--syntax-string)' },
  ]);
  return [C.syntaxHighlighting(hl), C.EditorView.theme({
    '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'var(--surface-sunken)', color: 'var(--syntax-plain)' },
    '.cm-scroller': { fontFamily: 'var(--f-mono)', lineHeight: '1.7' },
    '.cm-gutters': { backgroundColor: 'var(--surface-raised)', color: 'var(--text-muted)', border: 'none', borderRight: '1px solid var(--line)' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent-fill) 6%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent-text)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent-fill)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in srgb, var(--accent-fill) 30%, transparent) !important' },
    '.cm-changedLine': { backgroundColor: 'color-mix(in srgb, var(--secondary) 14%, transparent) !important' },
    '.cm-deletedChunk': { backgroundColor: 'color-mix(in srgb, var(--signal) 16%, transparent) !important' },
  })];
}
