describe('Core.colToProp', () => {
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

  it('should return the property name for the provided column number', () => {
    handsontable({
      data: [{
        id: 1,
        firstName: 'Tobias',
        lastName: 'Forge'
      }]
    });

    expect(colToProp(0)).toBe('id');
    expect(colToProp(1)).toBe('firstName');
    expect(colToProp(2)).toBe('lastName');
  });

  it('should return proper value after calling the function when columns was reorganized (data is array of arrays)', () => {
    const hot = handsontable({
      data: Handsontable.helper.createSpreadsheetData(5, 5)
    });

    hot.rowIndexMapper.setIndexesSequence([4, 3, 2, 1, 0]);
    hot.columnIndexMapper.setIndexesSequence([4, 3, 2, 1, 0]);

    expect(colToProp(0)).toBe(4);
    expect(colToProp(10)).toBe(null);
  });

  it('should return proper value after calling the function when columns was reorganized (data is array of objects)', () => {
    const hot = handsontable({
      data: [
        { id: 1, name: 'Ted', lastName: 'Right', date: '01/01/2015' },
        { id: 2, name: 'Frank', lastName: 'Honest', date: '01/01/15' },
        { id: 3, name: 'Joan', lastName: 'Well', date: '41/01/2015' },
        { id: 4, name: 'Sid', lastName: 'Strong', date: '01/51/2015' },
      ]
    });

    hot.rowIndexMapper.setIndexesSequence([3, 2, 1, 0]);
    hot.columnIndexMapper.setIndexesSequence([3, 2, 1, 0]);

    expect(colToProp(0)).toBe('date');
    expect(colToProp(10)).toBe(null);
  });
});
