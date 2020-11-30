import {
  expandMetaType,
  columnFactory,
  isUnsignedNumber,
  assert,
  isNullish
} from 'handsontable/dataMap/metaManager/utils';
import { registerCellType } from 'handsontable/cellTypes';
import { CELL_TYPE as AUTOCOMPLETE, AutocompleteType } from 'handsontable/cellTypes/autocompleteType';
import { CELL_TYPE as CHECKBOX, CheckboxType } from 'handsontable/cellTypes/checkboxType';
import { CELL_TYPE as DATE, DateType } from 'handsontable/cellTypes/dateType';
import { CELL_TYPE as DROPDOWN, DropdownType } from 'handsontable/cellTypes/dropdownType';
import { CELL_TYPE as HANDSONTABLE, HandsontableType } from 'handsontable/cellTypes/handsontableType';
import { CELL_TYPE as NUMERIC, NumericType } from 'handsontable/cellTypes/numericType';
import { CELL_TYPE as PASSWORD, PasswordType } from 'handsontable/cellTypes/passwordType';
import { CELL_TYPE as TEXT, TextType } from 'handsontable/cellTypes/textType';
import { CELL_TYPE as TIME, TimeType } from 'handsontable/cellTypes/timeType';

registerCellType(AUTOCOMPLETE, AutocompleteType);
registerCellType(CHECKBOX, CheckboxType);
registerCellType(DATE, DateType);
registerCellType(DROPDOWN, DropdownType);
registerCellType(HANDSONTABLE, HandsontableType);
registerCellType(NUMERIC, NumericType);
registerCellType(PASSWORD, PasswordType);
registerCellType(TEXT, TextType);
registerCellType(TIME, TimeType);

describe('MetaManager utils', () => {
  describe('expandMetaType', () => {
    it('should return "undefined" when an object doesn\'t have defined "type" property or is not supported', () => {
      expect(expandMetaType()).toBeUndefined();
      expect(expandMetaType(null)).toBeUndefined();
      expect(expandMetaType(1)).toBeUndefined();
      expect(expandMetaType(true)).toBeUndefined();
      expect(expandMetaType(NaN)).toBeUndefined();
      expect(expandMetaType([])).toBeUndefined();
    });

    it('should return only properties that are not defined on the child object', () => {
      class Child {
        constructor() {
          this.copyPaste = false;
        }
      }

      expect(expandMetaType({ copyPaste: true, test: 'foo' }, new Child())).toEqual({ test: 'foo' });

      expect(expandMetaType('autocomplete', { editor: () => {} })).toEqual({
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });

    it('should return a copy of the object that is holding by "type" property', () => {
      const type = { copyPaste: true, test: 'foo' };

      expect(expandMetaType(type)).not.toBe(type);
      expect(expandMetaType(type)).toEqual(type);
    });

    it('should return the object with defined properties defined by "autocomplete" cell type', () => {
      expect(expandMetaType('autocomplete')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "checkbox" cell type', () => {
      expect(expandMetaType('checkbox')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "date" cell type', () => {
      expect(expandMetaType('date')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "dropdown" cell type', () => {
      expect(expandMetaType('dropdown')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "handsontable" cell type', () => {
      expect(expandMetaType('handsontable')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "numeric" cell type', () => {
      expect(expandMetaType('numeric')).toEqual({
        dataType: 'number',
        editor: expect.any(Function),
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "password" cell type', () => {
      expect(expandMetaType('password')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
        copyable: false,
      });
    });

    it('should return the object with defined properties defined by "text" cell type', () => {
      expect(expandMetaType('text')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
      });
    });

    it('should return the object with defined properties defined by "time" cell type', () => {
      expect(expandMetaType('time')).toEqual({
        editor: expect.any(Function),
        renderer: expect.any(Function),
        validator: expect.any(Function),
      });
    });
  });

  describe('columnFactory', () => {
    it('should return new class', () => {
      class Parent {}

      const Column = columnFactory(Parent);
      const column = new Column();

      expect(column instanceof Parent).toBe(true);
    });

    it('should return new class with overwritten properties', () => {
      class Parent {}
      Parent.prototype.data = [];
      Parent.prototype.width = 100;
      Parent.prototype.copyPaste = true;

      const Column = columnFactory(Parent, ['data', 'width']);
      const column = new Column();

      expect(column.data).toBeUndefined();
      expect(column.width).toBeUndefined();
      expect(column.copyPaste).toBe(true);
    });
  });

  describe('isUnsignedNumber', () => {
    it('should return true only for valid signed numbers', () => {
      expect(isUnsignedNumber()).toBe(false);
      expect(isUnsignedNumber(null)).toBe(false);
      expect(isUnsignedNumber(false)).toBe(false);
      expect(isUnsignedNumber('')).toBe(false);
      expect(isUnsignedNumber('1')).toBe(false);
      expect(isUnsignedNumber({ a: 1 })).toBe(false);
      expect(isUnsignedNumber(Infinity)).toBe(false);
      expect(isUnsignedNumber(-1)).toBe(false);
      expect(isUnsignedNumber(-999)).toBe(false);

      expect(isUnsignedNumber(0)).toBe(true);
      expect(isUnsignedNumber(1)).toBe(true);
      expect(isUnsignedNumber(100)).toBe(true);
      expect(isUnsignedNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    });
  });

  describe('assert', () => {
    it('should not throw an error when condition returns true', () => {
      expect(() => {
        assert(() => true, 'Test');
      }).not.toThrow();
    });

    it('should throw an error with custom message when condition returns false', () => {
      expect(() => {
        assert(() => false, 'Test');
      }).toThrow('Assertion failed: Test');
    });
  });

  describe('isNullish', () => {
    it('should return true only for nullish values', () => {
      expect(isNullish()).toBe(true);
      expect(isNullish(null)).toBe(true);

      expect(isNullish(0)).toBe(false);
      expect(isNullish('')).toBe(false);
      expect(isNullish(NaN)).toBe(false);
      expect(isNullish({})).toBe(false);
      expect(isNullish([])).toBe(false);
    });
  });
});
