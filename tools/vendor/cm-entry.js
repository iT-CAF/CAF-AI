// CAF AI · © 2026 كآف · iT CAF — مدخل حزمة CodeMirror 6 المحلية (تُبنى مرة واحدة وقت التطوير).
// Entry point for the local CodeMirror 6 bundle (built once at dev time by tools/vendor/build.mjs).
export { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
export { EditorState, Compartment } from '@codemirror/state';
export { basicSetup } from 'codemirror';
export { indentWithTab, undo, redo } from '@codemirror/commands';
export { unifiedMergeView, MergeView } from '@codemirror/merge';
export { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
export { tags } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { xml } from '@codemirror/lang-xml';

// اسم اللغة ← دالة تُرجع امتداد CodeMirror المناسب
export const languages = {
  javascript: () => javascript(), js: () => javascript(), jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true }), ts: () => javascript({ typescript: true }), tsx: () => javascript({ jsx: true, typescript: true }),
  html: () => html(), css: () => css(), scss: () => css(), python: () => python(), py: () => python(),
  json: () => json(), markdown: () => markdown(), md: () => markdown(), php: () => php(), sql: () => sql(),
  java: () => java(), c: () => cpp(), cpp: () => cpp(), 'c++': () => cpp(), csharp: () => java(), rust: () => rust(), go: () => go(),
  xml: () => xml(), svg: () => xml(),
};
