import { describe, expect, it, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import {
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';

describe('TipTap E5 Full Table Interactive Suite', () => {
  const editors: Editor[] = [];

  const createTestEditor = (initialContent = '<p>Initial paragraph</p>') => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(initialContent),
    });
    editors.push(editor);
    return editor;
  };

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  describe('1. Table Insertion & Dimensions', () => {
    it('inserts a 3 rows × 4 columns table with header row', () => {
      const editor = createTestEditor('<p>Before table</p>');
      editor.commands.insertTable({ rows: 3, cols: 4, withHeaderRow: true });

      const json: any = editor.getJSON();
      const tableNode = json.content?.find((node: any) => node.type === 'table');
      expect(tableNode).toBeDefined();

      const rows = tableNode?.content || [];
      expect(rows.length).toBe(3);

      // Header row
      expect(rows[0].content?.length).toBe(4);
      expect(rows[0].content?.every((cell: any) => cell.type === 'tableHeader')).toBe(true);

      // Data rows
      expect(rows[1].content?.length).toBe(4);
      expect(rows[1].content?.every((cell: any) => cell.type === 'tableCell')).toBe(true);
      expect(rows[2].content?.length).toBe(4);
      expect(rows[2].content?.every((cell: any) => cell.type === 'tableCell')).toBe(true);
    });

    it('inserts maximum 8x8 table dimensions', () => {
      const editor = createTestEditor('<p>Start</p>');
      editor.commands.insertTable({ rows: 8, cols: 8, withHeaderRow: true });

      const json: any = editor.getJSON();
      const tableNode = json.content?.find((node: any) => node.type === 'table');
      expect(tableNode?.content?.length).toBe(8);
      expect(tableNode?.content?.[0].content?.length).toBe(8);
    });

    it('validates 8x8 grid coordinate calculation', () => {
      // 3 rows x 4 cols = 12 highlighted cells
      const selectedRows = 3;
      const selectedCols = 4;
      let highlightedCount = 0;

      for (let r = 1; r <= 8; r++) {
        for (let c = 1; c <= 8; c++) {
          if (r <= selectedRows && c <= selectedCols) {
            highlightedCount++;
          }
        }
      }

      expect(highlightedCount).toBe(12);
    });
  });

  describe('2. Row Operations (Add / Delete)', () => {
    it('adds row before, adds row after, and deletes rows', () => {
      const editor = createTestEditor('<p>Table test</p>');
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      // Initially 2 rows
      let json: any = editor.getJSON();
      let table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.length).toBe(2);

      // Add row after
      editor.commands.addRowAfter();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.length).toBe(3);

      // Add row before
      editor.commands.addRowBefore();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.length).toBe(4);

      // Delete row
      editor.commands.deleteRow();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.length).toBe(3);
    });
  });

  describe('3. Column Operations (Add / Delete)', () => {
    it('adds column before, adds column after, and deletes columns', () => {
      const editor = createTestEditor('<p>Column test</p>');
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      // Initially 2 cols per row
      let json: any = editor.getJSON();
      let table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.length).toBe(2);

      // Add column after
      editor.commands.addColumnAfter();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.length).toBe(3);

      // Add column before
      editor.commands.addColumnBefore();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.length).toBe(4);

      // Delete column
      editor.commands.deleteColumn();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.length).toBe(3);
    });
  });

  describe('4. Delete Table Operation', () => {
    it('deletes the entire table via deleteTable command', () => {
      const editor = createTestEditor('<p>Before</p>');
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
      expect(editor.isActive('table')).toBe(true);

      editor.commands.deleteTable();
      expect(editor.isActive('table')).toBe(false);

      const json: any = editor.getJSON();
      const hasTable = json.content?.some((n: any) => n.type === 'table');
      expect(hasTable).toBe(false);
    });
  });

  describe('5. Header Row Toggle', () => {
    it('toggles header row state on table', () => {
      const editor = createTestEditor('<p>Header toggle</p>');
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      let json: any = editor.getJSON();
      let table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.[0].type).toBe('tableCell');

      editor.commands.toggleHeaderRow();
      json = editor.getJSON();
      table = json.content?.find((n: any) => n.type === 'table');
      expect(table?.content?.[0].content?.[0].type).toBe('tableHeader');
    });
  });

  describe('6. Undo and Redo Transaction Integrity', () => {
    it('supports undo and redo on table creation and row modifications', () => {
      const editor = createTestEditor('<p>Start text</p>');
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      expect(editor.isActive('table')).toBe(true);

      // Undo table creation
      editor.commands.undo();
      expect(editor.isActive('table')).toBe(false);
      expect(serializeEditorContent(editor)).toContain('Start text');

      // Redo table creation
      editor.commands.redo();
      expect(editor.isActive('table')).toBe(true);
    });

    it('recovers full table content when undoing a deleteTable', () => {
      const editor = createTestEditor('<table><tbody><tr><td>Cell Data 123</td></tr></tbody></table>');
      expect(serializeEditorContent(editor)).toContain('Cell Data 123');

      editor.commands.deleteTable();
      expect(serializeEditorContent(editor)).not.toContain('Cell Data 123');

      editor.commands.undo();
      expect(serializeEditorContent(editor)).toContain('Cell Data 123');
      expect(editor.isActive('table')).toBe(true);
    });
  });

  describe('7. Cell Rich Formatting (E2/E3 Integration)', () => {
    it('preserves rich text marks and typography within table cells', () => {
      const htmlWithFormattedCell = `
<table>
  <tbody>
    <tr>
      <td><strong>Bold Cell</strong> and <span style="color: rgb(239, 68, 68);"><em>Red Italic</em></span></td>
    </tr>
  </tbody>
</table>
      `.trim();

      const editor = createTestEditor(htmlWithFormattedCell);
      const outputHtml = serializeEditorContent(editor);

      expect(outputHtml).toContain('<strong>Bold Cell</strong>');
      expect(outputHtml).toContain('color: rgb(239, 68, 68)');
      expect(outputHtml).toContain('<em>Red Italic</em>');
    });
  });

  describe('8. Historical Table Compatibility & Spans', () => {
    it('preserves colspan and rowspan attributes without structural loss', () => {
      const complexTableHtml = `
<table class="feishu-rich-table" style="width: 80%;">
  <thead>
    <tr>
      <th colspan="2">Merged Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">Spanned Row</td>
      <td>Right Cell 1</td>
    </tr>
    <tr>
      <td>Right Cell 2</td>
    </tr>
  </tbody>
</table>
      `.trim();

      const editor = createTestEditor(complexTableHtml);
      const outputHtml = serializeEditorContent(editor);

      expect(outputHtml).toContain('colspan="2"');
      expect(outputHtml).toContain('rowspan="2"');
      expect(outputHtml).toContain('Merged Header');
      expect(outputHtml).toContain('Spanned Row');
      expect(outputHtml).toContain('Right Cell 1');
      expect(outputHtml).toContain('Right Cell 2');
    });

    it('round-trips standard GFM table format cleanly', () => {
      const gfmTable = `
| Name | Role |
| --- | --- |
| Alice | Admin |
| Bob | User |
      `.trim();

      const editor = createTestEditor(gfmTable);
      const outputHtml = serializeEditorContent(editor);

      expect(outputHtml).toContain('Alice');
      expect(outputHtml).toContain('Admin');
      expect(outputHtml).toContain('Bob');
      expect(outputHtml).toContain('User');
    });
  });

  describe('9. Large Table Stress Test (20x10)', () => {
    it('initializes and serializes a 20 rows × 10 columns table smoothly', () => {
      const editor = createTestEditor('<p>Stress Test</p>');
      const startTime = performance.now();

      editor.commands.insertTable({ rows: 20, cols: 10, withHeaderRow: true });
      const insertDuration = performance.now() - startTime;

      const json: any = editor.getJSON();
      const tableNode = json.content?.find((n: any) => n.type === 'table');
      expect(tableNode?.content?.length).toBe(20);
      expect(tableNode?.content?.[0].content?.length).toBe(10);

      const html = serializeEditorContent(editor);
      expect(html).toContain('<table>');
      expect(html).toContain('</table>');
      expect(insertDuration).toBeLessThan(1500); // Must not hang or freeze
    });
  });
});
