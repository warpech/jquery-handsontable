describe('HiddenRows', () => {
  const id = 'testContainer';

  function extractDOMStructure(overlay) {
    const overlayBody = overlay.find('tbody')[0].cloneNode(true);

    Array.from(overlayBody.querySelectorAll('th')).forEach((TH) => {
      // Simplify header content
      TH.innerText = TH.querySelector('.rowHeader').innerText;
      TH.removeAttribute('style');
    });

    return `${overlayBody.outerHTML}`;
  }

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  describe('fixedRowsTop', () => {
    it('should reduce fixed rows by the number of hidden rows (the first row from top overlay is hidden)', () => {
      handsontable({
        data: Handsontable.helper.createSpreadsheetData(10, 1),
        rowHeaders: true,
        hiddenRows: {
          rows: [0],
          indicators: true
        },
        fixedRowsTop: 3
      });

      expect(getTopClone().find('tbody tr').length).toBe(2);
      expect(extractDOMStructure(getTopClone())).toMatchHTML(`
        <tbody class="afterEmptyThead">
          <tr>
            <th class="${CSS_CLASS_AFTER_HIDDEN}">2</th>
            <td class="${CSS_CLASS_AFTER_HIDDEN}">A2</td>
          </tr>
          <tr>
            <th class="">3</th>
            <td class="">A3</td>
          </tr>
        </tbody>
        `);
    });

    it('should reduce fixed rows by the number of hidden rows (the second row from bottom overlay is hidden)', () => {
      handsontable({
        data: Handsontable.helper.createSpreadsheetData(10, 1),
        rowHeaders: true,
        hiddenRows: {
          rows: [1],
          indicators: true
        },
        fixedRowsTop: 3
      });

      expect(getTopClone().find('tbody tr').length).toBe(2);
      expect(extractDOMStructure(getTopClone())).toMatchHTML(`
        <tbody class="afterEmptyThead">
          <tr>
            <th class="${CSS_CLASS_BEFORE_HIDDEN}">1</th>
            <td class="">A1</td>
          </tr>
          <tr>
            <th class="${CSS_CLASS_AFTER_HIDDEN}">3</th>
            <td class="${CSS_CLASS_AFTER_HIDDEN}">A3</td>
          </tr>
        </tbody>
        `);
    });

    it('should reduce fixed rows by the number of hidden rows (two last rows within top overlay are hidden)', () => {
      handsontable({
        data: Handsontable.helper.createSpreadsheetData(10, 1),
        rowHeaders: true,
        hiddenRows: {
          rows: [1, 2],
          indicators: true
        },
        fixedRowsTop: 3
      });

      expect(getTopClone().find('tbody tr').length).toBe(1);
      expect(extractDOMStructure(getTopClone())).toMatchHTML(`
        <tbody class="afterEmptyThead">
          <tr>
            <th class="${CSS_CLASS_BEFORE_HIDDEN}">1</th>
            <td class="">A1</td>
          </tr>
        </tbody>
        `);
    });

    it('should reduce fixed rows by the number of hidden rows (total hidden rows are greater ' +
       'than fixedRowsTop and one row is not hidden within fixed rows range)', () => {
      handsontable({
        data: Handsontable.helper.createSpreadsheetData(10, 1),
        rowHeaders: true,
        hiddenRows: {
          rows: [0, 2, 3, 4, 5, 6, 7, 8],
          indicators: true
        },
        fixedRowsTop: 3
      });

      expect(getTopClone().find('tbody tr').length).toBe(1);
      expect(extractDOMStructure(getTopClone())).toMatchHTML(`
        <tbody class="afterEmptyThead">
          <tr>
            <th class="${CSS_CLASS_AFTER_HIDDEN} ${CSS_CLASS_BEFORE_HIDDEN}">2</th>
            <td class="${CSS_CLASS_AFTER_HIDDEN}">A2</td>
          </tr>
        </tbody>
        `);
    });

    it('should reduce fixed rows to 0 when all rows all hidden', () => {
      handsontable({
        data: Handsontable.helper.createSpreadsheetData(10, 1),
        rowHeaders: true,
        hiddenRows: {
          rows: [0, 1, 2, 3, 4],
          indicators: true
        },
        fixedRowsTop: 3
      });

      expect(getTopClone().find('tbody tr').length).toBe(0);
      expect(extractDOMStructure(getTopClone())).toMatchHTML(`
        <tbody>
        </tbody>
        `);
    });
  });
});
