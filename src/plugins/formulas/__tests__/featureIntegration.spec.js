import HyperFormula from 'hyperformula';

describe('Integration with other features', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  describe('Integration with alter', () => {
    it('should allow inserting rows and columns with the formula plugin enabled', () => {
      const hot = handsontable({
        data: [['foo', null], ['=A1', null]],
        formulas: {
          engine: HyperFormula,
          sheetName: 'Sheet1'
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      alter('insert_row', 0, 1);
      alter('insert_row', 2, 1);
      alter('insert_row', hot.countRows(), 1);

      expect(hot.countRows()).toEqual(5);

      alter('insert_col', 0, 1);
      alter('insert_col', 2, 1);
      alter('insert_col', hot.countCols(), 1);

      expect(hot.countCols()).toEqual(5);
    });
  });

  describe('Integration with Copy/Paste', () => {
    it('should allow pasting data near the table borders (thus extending the table)', () => {
      const hot = handsontable({
        data: [[1, 'x'], ['=A1 + 1', 'y']],
        formulas: {
          engine: HyperFormula,
          sheetName: 'Sheet1'
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const copyEvent = getClipboardEvent();
      const copyPastePlugin = getPlugin('CopyPaste');

      selectCell(0, 0, 1, 1);

      copyPastePlugin.onCopy(copyEvent);

      selectCell(1, 1);

      copyPastePlugin.onPaste(copyEvent);

      expect(hot.countRows()).toEqual(3);
      expect(hot.countCols()).toEqual(3);
      expect(hot.getData()).toEqual([
        [1, 'x', null],
        [2, '1', 'x'],
        [null, '2', 'y']
      ]);
    });
  });

  describe('Integration with minSpareRows/minSpareCols', () => {
    it('should display the minSpareRows and minSpareCols properly', () => {
      const hot = handsontable({
        data: [[1, 'x'], ['=A1 + 1', 'y']],
        formulas: {
          engine: HyperFormula,
          sheetName: 'Sheet1'
        },
        minSpareRows: 3,
        minSpareCols: 3,
        licenseKey: 'non-commercial-and-evaluation'
      });

      expect(hot.countRows()).toEqual(5);
      expect(hot.countCols()).toEqual(5);
      expect(hot.getData()).toEqual([
        [1, 'x', null, null, null],
        [2, 'y', null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null]
      ]);
    });
  });

  describe('Integration with Autofill', () => {
    it('should allow dragging the fill handle outside of the table, adding new rows and performing autofill', async() => {
      const hot = handsontable({
        data: [
          ['test', 2, '=UPPER($A$1)', 4, 5, 6],
          [1, 2, 3, 4, 5, 6],
          [1, 2, 3, 4, 5, 6],
          [1, 2, 3, 4, 5, 6]
        ],
        formulas: {
          engine: HyperFormula,
          sheetName: 'Sheet1'
        },
        fillHandle: true
      });

      selectCell(0, 2);

      spec().$container.find('.wtBorder.current.corner').simulate('mousedown');
      spec().$container.find('tr:last-child td:eq(2)').simulate('mouseover');

      expect(hot.countRows()).toBe(4);

      await sleep(300);
      expect(hot.countRows()).toBe(5);

      spec().$container.find('tr:last-child td:eq(2)').simulate('mouseover');

      await sleep(300);
      expect(hot.countRows()).toBe(6);

      spec().$container.find('tr:last-child td:eq(2)').simulate('mouseup');

      await sleep(300);

      expect(hot.getData()).toEqual([
        ['test', 2, 'TEST', 4, 5, 6],
        [1, 2, 'TEST', 4, 5, 6],
        [1, 2, 'TEST', 4, 5, 6],
        [1, 2, 'TEST', 4, 5, 6],
        [null, null, 'TEST', null, null, null],
        [null, null, null, null, null, null]
      ]);

      expect(hot.getSourceData()).toEqual([
        ['test', 2, '=UPPER($A$1)', 4, 5, 6],
        [1, 2, '=UPPER($A$1)', 4, 5, 6],
        [1, 2, '=UPPER($A$1)', 4, 5, 6],
        [1, 2, '=UPPER($A$1)', 4, 5, 6],
        [null, null, '=UPPER($A$1)', null, null, null],
        [null, null, null, null, null, null]
      ]);
    });
  });
});
