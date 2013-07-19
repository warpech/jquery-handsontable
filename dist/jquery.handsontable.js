/**
 * Handsontable 0.9.9
 * Handsontable is a simple jQuery plugin for editable tables with basic copy-paste compatibility with Excel and Google Docs
 *
 * Copyright 2012, Marcin Warpechowski
 * Licensed under the MIT license.
 * http://handsontable.com/
 *
 * Date: Fri Jul 19 2013 17:59:45 GMT-0400 (EDT)
 */
/*jslint white: true, browser: true, plusplus: true, indent: 4, maxerr: 50 */

var Handsontable = { //class namespace
  extension: {}, //extenstion namespace
  helper: {} //helper namespace
};

(function ($, window, Handsontable) {
  "use strict";

// Override locally to prevent 3rd party libraries from trying to export
var define = null;

Handsontable.activeGuid = null;

/**
 * Handsontable constructor
 * @param rootElement The jQuery element in which Handsontable DOM will be inserted
 * @param userSettings
 * @constructor
 */
Handsontable.Core = function (rootElement, userSettings) {
  var priv
    , datamap
    , grid
    , selection
    , editproxy
    , autofill
    , instance = this
    , GridSettings = function () {
    };

  Handsontable.helper.inherit(GridSettings, DefaultSettings); //create grid settings as a copy of default settings
  Handsontable.helper.extend(GridSettings.prototype, userSettings); //overwrite defaults with user settings

  this.rootElement = rootElement;
  var $document = $(document.documentElement);
  var $body = $(document.body);
  this.guid = 'ht_' + Handsontable.helper.randomString(); //this is the namespace for global events

  if (!this.rootElement[0].id) {
    this.rootElement[0].id = this.guid; //if root element does not have an id, assign a random id
  }

  priv = {
    cellSettings: [],
    columnSettings: [],
    columnsSettingConflicts: ['data', 'width'],
    settings: new GridSettings(), // current settings instance
    settingsFromDOM: {},
    selStart: new Handsontable.SelectionPoint(),
    selEnd: new Handsontable.SelectionPoint(),
    editProxy: false,
    isPopulated: null,
    scrollable: null,
    undoRedo: null,
    extensions: {},
    colToProp: null,
    propToCol: null,
    dataSchema: null,
    dataType: 'array',
    firstRun: true
  };

  datamap = {
    recursiveDuckSchema: function (obj) {
      var schema;
      if ($.isPlainObject(obj)) {
        schema = {};
        for (var i in obj) {
          if (obj.hasOwnProperty(i)) {
            if ($.isPlainObject(obj[i])) {
              schema[i] = datamap.recursiveDuckSchema(obj[i]);
            }
            else {
              schema[i] = null;
            }
          }
        }
      }
      else {
        schema = [];
      }
      return schema;
    },

    recursiveDuckColumns: function (schema, lastCol, parent) {
      var prop, i;
      if (typeof lastCol === 'undefined') {
        lastCol = 0;
        parent = '';
      }
      if ($.isPlainObject(schema)) {
        for (i in schema) {
          if (schema.hasOwnProperty(i)) {
            if (schema[i] === null) {
              prop = parent + i;
              priv.colToProp.push(prop);
              priv.propToCol[prop] = lastCol;
              lastCol++;
            }
            else {
              lastCol = datamap.recursiveDuckColumns(schema[i], lastCol, i + '.');
            }
          }
        }
      }
      return lastCol;
    },

    createMap: function () {
      if (typeof datamap.getSchema() === "undefined") {
        throw new Error("trying to create `columns` definition but you didnt' provide `schema` nor `data`");
      }
      var i, ilen, schema = datamap.getSchema();
      priv.colToProp = [];
      priv.propToCol = {};
      if (priv.settings.columns) {
        for (i = 0, ilen = priv.settings.columns.length; i < ilen; i++) {
          priv.colToProp[i] = priv.settings.columns[i].data;
          priv.propToCol[priv.settings.columns[i].data] = i;
        }
      }
      else {
        datamap.recursiveDuckColumns(schema);
      }
    },

    colToProp: function (col) {
      col = Handsontable.PluginHooks.execute(instance, 'modifyCol', col);
      if (priv.colToProp && typeof priv.colToProp[col] !== 'undefined') {
        return priv.colToProp[col];
      }
      else {
        return col;
      }
    },

    propToCol: function (prop) {
      var col;
      if (typeof priv.propToCol[prop] !== 'undefined') {
        col = priv.propToCol[prop];
      }
      else {
        col = prop;
      }
      col = Handsontable.PluginHooks.execute(instance, 'modifyCol', col);
      return col;
    },

    getSchema: function () {
      if (priv.settings.dataSchema) {
        if (typeof priv.settings.dataSchema === 'function') {
          return priv.settings.dataSchema();
        }
        return priv.settings.dataSchema;
      }
      return priv.duckDataSchema;
    },

    /**
     * Creates row at the bottom of the data array
     * @param {Number} [index] Optional. Index of the row before which the new row will be inserted
     */
    createRow: function (index) {
      var row
        , rowCount = instance.countRows();

      if (typeof index !== 'number' || index >= rowCount) {
        index = rowCount;
      }

      if (priv.dataType === 'array') {
        row = [];
        for (var c = 0, clen = instance.countCols(); c < clen; c++) {
          row.push(null);
        }
      }
      else if (priv.dataType === 'function') {
        row = priv.settings.dataSchema(index);
      }
      else {
        row = $.extend(true, {}, datamap.getSchema());
      }

      if (index === rowCount) {
        GridSettings.prototype.data.push(row);
      }
      else {
        GridSettings.prototype.data.splice(index, 0, row);
      }

      instance.PluginHooks.run('afterCreateRow', index);
      instance.forceFullRender = true; //used when data was changed
    },

    /**
     * Creates col at the right of the data array
     * @param {Object} [index] Optional. Index of the column before which the new column will be inserted
     */
    createCol: function (index) {
      if (priv.dataType === 'object' || priv.settings.columns) {
        throw new Error("Cannot create new column. When data source in an object, you can only have as much columns as defined in first data row, data schema or in the 'columns' setting");
      }
      var r = 0, rlen = instance.countRows()
        , data = GridSettings.prototype.data
        , constructor = Handsontable.helper.columnFactory(GridSettings, priv.columnsSettingConflicts, Handsontable.TextCell);

      if (typeof index !== 'number' || index >= instance.countCols()) {
        for (; r < rlen; r++) {
          if (typeof data[r] === 'undefined') {
            data[r] = [];
          }
          data[r].push(null);
        }
        // Add new column constructor
        priv.columnSettings.push(constructor);
      }
      else {
        for (; r < rlen; r++) {
          data[r].splice(index, 0, null);
        }
        // Add new column constructor at given index
        priv.columnSettings.splice(index, 0, constructor);
      }
      instance.PluginHooks.run('afterCreateCol', index);
      instance.forceFullRender = true; //used when data was changed
    },

    /**
     * Removes row from the data array
     * @param {Number} [index] Optional. Index of the row to be removed. If not provided, the last row will be removed
     * @param {Number} [amount] Optional. Amount of the rows to be removed. If not provided, one row will be removed
     */
    removeRow: function (index, amount) {
      if (!amount) {
        amount = 1;
      }
      if (typeof index !== 'number') {
        index = -amount;
      }
      GridSettings.prototype.data.splice(index, amount);
      instance.PluginHooks.run('afterRemoveRow', index, amount);
      instance.forceFullRender = true; //used when data was changed
    },

    /**
     * Removes column from the data array
     * @param {Number} [index] Optional. Index of the column to be removed. If not provided, the last column will be removed
     * @param {Number} [amount] Optional. Amount of the columns to be removed. If not provided, one column will be removed
     */
    removeCol: function (index, amount) {
      if (priv.dataType === 'object' || priv.settings.columns) {
        throw new Error("cannot remove column with object data source or columns option specified");
      }
      if (!amount) {
        amount = 1;
      }
      if (typeof index !== 'number') {
        index = -amount;
      }
      var data = GridSettings.prototype.data;
      for (var r = 0, rlen = instance.countRows(); r < rlen; r++) {
        data[r].splice(index, amount);
      }
      instance.PluginHooks.run('afterRemoveCol', index, amount);
      priv.columnSettings.splice(index, amount);
      instance.forceFullRender = true; //used when data was changed
    },

    /**
     * Add / removes data from the column
     * @param {Number} col Index of column in which do you want to do splice.
     * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end
     * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed
     * param {...*} elements Optional. The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array
     */
    spliceCol: function (col, index, amount/*, elements...*/) {
      var elements = 4 <= arguments.length ? [].slice.call(arguments, 3) : [];

      var colData = instance.getDataAtCol(col);
      var removed = colData.slice(index, index + amount);
      var after = colData.slice(index + amount);

      Handsontable.helper.extendArray(elements, after);
      var i = 0;
      while (i < amount) {
        elements.push(null); //add null in place of removed elements
        i++;
      }
      Handsontable.helper.to2dArray(elements);
      instance.populateFromArray(index, col, elements, null, null, 'spliceCol');

      return removed;
    },

    /**
     * Add / removes data from the row
     * @param {Number} row Index of row in which do you want to do splice.
     * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end
     * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed
     * param {...*} elements Optional. The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array
     */
    spliceRow: function (row, index, amount/*, elements...*/) {
      var elements = 4 <= arguments.length ? [].slice.call(arguments, 3) : [];

      var rowData = instance.getDataAtRow(row);
      var removed = rowData.slice(index, index + amount);
      var after = rowData.slice(index + amount);

      Handsontable.helper.extendArray(elements, after);
      var i = 0;
      while (i < amount) {
        elements.push(null); //add null in place of removed elements
        i++;
      }
      instance.populateFromArray(row, index, [elements], null, null, 'spliceRow');

      return removed;
    },

    /**
     * Returns single value from the data array
     * @param {Number} row
     * @param {Number} prop
     */
    getVars: {},
    get: function (row, prop) {
      datamap.getVars.row = row;
      datamap.getVars.prop = prop;
      instance.PluginHooks.run('beforeGet', datamap.getVars);
      if (typeof datamap.getVars.prop === 'string' && datamap.getVars.prop.indexOf('.') > -1) {
        var sliced = datamap.getVars.prop.split(".");
        var out = priv.settings.data[datamap.getVars.row];
        if (!out) {
          return null;
        }
        for (var i = 0, ilen = sliced.length; i < ilen; i++) {
          out = out[sliced[i]];
          if (typeof out === 'undefined') {
            return null;
          }
        }
        return out;
      }
      else if (typeof datamap.getVars.prop === 'function') {
        /**
         *  allows for interacting with complex structures, for example
         *  d3/jQuery getter/setter properties:
         *
         *    {columns: [{
         *      data: function(row, value){
         *        if(arguments.length === 1){
         *          return row.property();
         *        }
         *        row.property(value);
         *      }
         *    }]}
         */
        return datamap.getVars.prop(priv.settings.data.slice(
          datamap.getVars.row,
          datamap.getVars.row + 1
        )[0]);
      }
      else {
        return priv.settings.data[datamap.getVars.row] ? priv.settings.data[datamap.getVars.row][datamap.getVars.prop] : null;
      }
    },

    /**
     * Saves single value to the data array
     * @param {Number} row
     * @param {Number} prop
     * @param {String} value
     * @param {String} [source] Optional. Source of hook runner.
     */
    setVars: {},
    set: function (row, prop, value, source) {
      datamap.setVars.row = row;
      datamap.setVars.prop = prop;
      datamap.setVars.value = value;
      instance.PluginHooks.run('beforeSet', datamap.setVars, source || "datamapGet");
      if (typeof datamap.setVars.prop === 'string' && datamap.setVars.prop.indexOf('.') > -1) {
        var sliced = datamap.setVars.prop.split(".");
        var out = priv.settings.data[datamap.setVars.row];
        for (var i = 0, ilen = sliced.length - 1; i < ilen; i++) {
          out = out[sliced[i]];
        }
        out[sliced[i]] = datamap.setVars.value;
      }
      else if (typeof datamap.setVars.prop === 'function') {
        /* see the `function` handler in `get` */
        datamap.setVars.prop(priv.settings.data.slice(
          datamap.setVars.row,
          datamap.setVars.row + 1
        )[0], datamap.setVars.value);
      }
      else {
        priv.settings.data[datamap.setVars.row][datamap.setVars.prop] = datamap.setVars.value;
      }
    },

    /**
     * Clears the data array
     */
    clear: function () {
      for (var r = 0; r < instance.countRows(); r++) {
        for (var c = 0; c < instance.countCols(); c++) {
          datamap.set(r, datamap.colToProp(c), '');
        }
      }
    },

    /**
     * Returns the data array
     * @return {Array}
     */
    getAll: function () {
      return priv.settings.data;
    },

    /**
     * Returns data range as array
     * @param {Object} start Start selection position
     * @param {Object} end End selection position
     * @return {Array}
     */
    getRange: function (start, end) {
      var r, rlen, c, clen, output = [], row;
      rlen = Math.max(start.row, end.row);
      clen = Math.max(start.col, end.col);
      for (r = Math.min(start.row, end.row); r <= rlen; r++) {
        row = [];
        for (c = Math.min(start.col, end.col); c <= clen; c++) {
          row.push(datamap.get(r, datamap.colToProp(c)));
        }
        output.push(row);
      }
      return output;
    },

    /**
     * Return data as text (tab separated columns)
     * @param {Object} start (Optional) Start selection position
     * @param {Object} end (Optional) End selection position
     * @return {String}
     */
    getText: function (start, end) {
      return SheetClip.stringify(datamap.getRange(start, end));
    }
  };

  grid = {
    /**
     * Inserts or removes rows and columns
     * @param {String} action Possible values: "insert_row", "insert_col", "remove_row", "remove_col"
     * @param {Number} index
     * @param {Number} amount
     * @param {String} [source] Optional. Source of hook runner.
     * @param {Boolean} [keepEmptyRows] Optional. Flag for preventing deletion of empty rows.
     */
    alter: function (action, index, amount, source, keepEmptyRows) {
      var oldData, newData, changes, r, rlen, c, clen, delta;
      oldData = $.extend(true, [], datamap.getAll());

      switch (action) {
        case "insert_row":
          if (!amount) {
            amount = 1;
          }
          delta = 0;
          while (delta < amount && instance.countRows() < priv.settings.maxRows) {
            datamap.createRow(index);
            delta++;
          }
          if (delta) {
            if (priv.selStart.exists() && priv.selStart.row() >= index) {
              priv.selStart.row(priv.selStart.row() + delta);
              selection.transformEnd(delta, 0); //will call render() internally
            }
            else {
              selection.refreshBorders(); //it will call render and prepare methods
            }
          }
          break;

        case "insert_col":
          if (!amount) {
            amount = 1;
          }
          delta = 0;
          while (delta < amount && instance.countCols() < priv.settings.maxCols) {
            datamap.createCol(index);
            delta++;
          }
          if (delta) {
            if (priv.selStart.exists() && priv.selStart.col() >= index) {
              priv.selStart.col(priv.selStart.col() + delta);
              selection.transformEnd(0, delta); //will call render() internally
            }
            else {
              selection.refreshBorders(); //it will call render and prepare methods
            }
          }
          break;

        case "remove_row":
          datamap.removeRow(index, amount);
          grid.adjustRowsAndCols();
          selection.refreshBorders(); //it will call render and prepare methods
          break;

        case "remove_col":
          datamap.removeCol(index, amount);
          grid.adjustRowsAndCols();
          selection.refreshBorders(); //it will call render and prepare methods
          break;

        default:
          throw new Error('There is no such action "' + action + '"');
          break;
      }

      changes = [];
      newData = datamap.getAll();
      for (r = 0, rlen = newData.length; r < rlen; r++) {
        for (c = 0, clen = newData[r].length; c < clen; c++) {
          changes.push([r, c, oldData[r] ? oldData[r][c] : null, newData[r][c]]);
        }
      }
      instance.PluginHooks.run('afterChange', changes, source || action);
      if (!keepEmptyRows) {
        grid.adjustRowsAndCols(); //makes sure that we did not add rows that will be removed in next refresh
      }
    },

    /**
     * Makes sure there are empty rows at the bottom of the table
     */
    adjustRowsAndCols: function () {
      var r, rlen, emptyRows = instance.countEmptyRows(true), emptyCols;

      //should I add empty rows to data source to meet minRows?
      rlen = instance.countRows();
      if (rlen < priv.settings.minRows) {
        for (r = 0; r < priv.settings.minRows - rlen; r++) {
          datamap.createRow();
        }
      }

      //should I add empty rows to meet minSpareRows?
      if (emptyRows < priv.settings.minSpareRows) {
        for (; emptyRows < priv.settings.minSpareRows && instance.countRows() < priv.settings.maxRows; emptyRows++) {
          datamap.createRow();
        }
      }

      //count currently empty cols
      emptyCols = instance.countEmptyCols(true);

      //should I add empty cols to meet minCols?
      if (!priv.settings.columns && instance.countCols() < priv.settings.minCols) {
        for (; instance.countCols() < priv.settings.minCols; emptyCols++) {
          datamap.createCol();
        }
      }

      //should I add empty cols to meet minSpareCols?
      if (!priv.settings.columns && priv.dataType === 'array' && emptyCols < priv.settings.minSpareCols) {
        for (; emptyCols < priv.settings.minSpareCols && instance.countCols() < priv.settings.maxCols; emptyCols++) {
          datamap.createCol();
        }
      }

      if (priv.settings.enterBeginsEditing) {
        for (; (((priv.settings.minRows || priv.settings.minSpareRows) && instance.countRows() > priv.settings.minRows) && (priv.settings.minSpareRows && emptyRows > priv.settings.minSpareRows)); emptyRows--) {
          datamap.removeRow();
        }
      }

      if (priv.settings.enterBeginsEditing && !priv.settings.columns) {
        for (; (((priv.settings.minCols || priv.settings.minSpareCols) && instance.countCols() > priv.settings.minCols) && (priv.settings.minSpareCols && emptyCols > priv.settings.minSpareCols)); emptyCols--) {
          datamap.removeCol();
        }
      }

      var rowCount = instance.countRows();
      var colCount = instance.countCols();

      if (rowCount === 0 || colCount === 0) {
        selection.deselect();
      }

      if (priv.selStart.exists()) {
        var selectionChanged;
        var fromRow = priv.selStart.row();
        var fromCol = priv.selStart.col();
        var toRow = priv.selEnd.row();
        var toCol = priv.selEnd.col();

        //if selection is outside, move selection to last row
        if (fromRow > rowCount - 1) {
          fromRow = rowCount - 1;
          selectionChanged = true;
          if (toRow > fromRow) {
            toRow = fromRow;
          }
        } else if (toRow > rowCount - 1) {
          toRow = rowCount - 1;
          selectionChanged = true;
          if (fromRow > toRow) {
            fromRow = toRow;
          }
        }

        //if selection is outside, move selection to last row
        if (fromCol > colCount - 1) {
          fromCol = colCount - 1;
          selectionChanged = true;
          if (toCol > fromCol) {
            toCol = fromCol;
          }
        } else if (toCol > colCount - 1) {
          toCol = colCount - 1;
          selectionChanged = true;
          if (fromCol > toCol) {
            fromCol = toCol;
          }
        }

        if (selectionChanged) {
          instance.selectCell(fromRow, fromCol, toRow, toCol);
        }
      }
    },

    /**
     * Populate cells at position with 2d array
     * @param {Object} start Start selection position
     * @param {Array} input 2d array
     * @param {Object} [end] End selection position (only for drag-down mode)
     * @param {String} [source="populateFromArray"]
     * @param {String} [method="overwrite"]
     * @return {Object|undefined} ending td in pasted area (only if any cell was changed)
     */
    populateFromArray: function (start, input, end, source, method) {
      var r, rlen, c, clen, setData = [], current = {};
      rlen = input.length;
      if (rlen === 0) {
        return false;
      }

      var repeatCol
        , repeatRow
        , cmax
        , rmax;

      // insert data with specified pasteMode method
      switch (method) {
        case 'shift_down' :
          repeatCol = end ? end.col - start.col + 1 : 0;
          repeatRow = end ? end.row - start.row + 1 : 0;
          input = Handsontable.helper.translateRowsToColumns(input);
          for (c = 0, clen = input.length, cmax = Math.max(clen, repeatCol); c < cmax; c++) {
            if (c < clen) {
              for (r = 0, rlen = input[c].length; r < repeatRow - rlen; r++) {
                input[c].push(input[c][r % rlen]);
              }
              input[c].unshift(start.col + c, start.row, 0);
              instance.spliceCol.apply(instance, input[c]);
            }
            else {
              input[c % clen][0] = start.col + c;
              instance.spliceCol.apply(instance, input[c % clen]);
            }
          }
          break;

        case 'shift_right' :
          repeatCol = end ? end.col - start.col + 1 : 0;
          repeatRow = end ? end.row - start.row + 1 : 0;
          for (r = 0, rlen = input.length, rmax = Math.max(rlen, repeatRow); r < rmax; r++) {
            if (r < rlen) {
              for (c = 0, clen = input[r].length; c < repeatCol - clen; c++) {
                input[r].push(input[r][c % clen]);
              }
              input[r].unshift(start.row + r, start.col, 0);
              instance.spliceRow.apply(instance, input[r]);
            }
            else {
              input[r % rlen][0] = start.row + r;
              instance.spliceRow.apply(instance, input[r % rlen]);
            }
          }
          break;

        case 'overwrite' :
        default:
          // overwrite and other not specified options
          current.row = start.row;
          current.col = start.col;
          for (r = 0; r < rlen; r++) {
            if ((end && current.row > end.row) || (!priv.settings.minSpareRows && current.row > instance.countRows() - 1) || (current.row >= priv.settings.maxRows)) {
              break;
            }
            current.col = start.col;
            clen = input[r] ? input[r].length : 0;
            for (c = 0; c < clen; c++) {
              if ((end && current.col > end.col) || (!priv.settings.minSpareCols && current.col > instance.countCols() - 1) || (current.col >= priv.settings.maxCols)) {
                break;
              }
              if (instance.getCellMeta(current.row, current.col).isWritable) {
                setData.push([current.row, current.col, input[r][c]]);
              }
              current.col++;
              if (end && c === clen - 1) {
                c = -1;
              }
            }
            current.row++;
            if (end && r === rlen - 1) {
              r = -1;
            }
          }
          instance.setDataAtCell(setData, null, null, source || 'populateFromArray');
          break;
      }
    },

    /**
     * Returns the top left (TL) and bottom right (BR) selection coordinates
     * @param {Object[]} coordsArr
     * @returns {Object}
     */
    getCornerCoords: function (coordsArr) {
      function mapProp(func, array, prop) {
        function getProp(el) {
          return el[prop];
        }

        if (Array.prototype.map) {
          return func.apply(Math, array.map(getProp));
        }
        return func.apply(Math, $.map(array, getProp));
      }

      return {
        TL: {
          row: mapProp(Math.min, coordsArr, "row"),
          col: mapProp(Math.min, coordsArr, "col")
        },
        BR: {
          row: mapProp(Math.max, coordsArr, "row"),
          col: mapProp(Math.max, coordsArr, "col")
        }
      };
    },

    /**
     * Returns array of td objects given start and end coordinates
     */
    getCellsAtCoords: function (start, end) {
      var corners = grid.getCornerCoords([start, end]);
      var r, c, output = [];
      for (r = corners.TL.row; r <= corners.BR.row; r++) {
        for (c = corners.TL.col; c <= corners.BR.col; c++) {
          output.push(instance.view.getCellAtCoords({
            row: r,
            col: c
          }));
        }
      }
      return output;
    }
  };

  this.selection = selection = { //this public assignment is only temporary
    inProgress: false,

    /**
     * Sets inProgress to true. This enables onSelectionEnd and onSelectionEndByProp to function as desired
     */
    begin: function () {
      instance.selection.inProgress = true;
    },

    /**
     * Sets inProgress to false. Triggers onSelectionEnd and onSelectionEndByProp
     */
    finish: function () {
      var sel = instance.getSelected();
      instance.PluginHooks.run("afterSelectionEnd", sel[0], sel[1], sel[2], sel[3]);
      instance.PluginHooks.run("afterSelectionEndByProp", sel[0], instance.colToProp(sel[1]), sel[2], instance.colToProp(sel[3]));
      instance.selection.inProgress = false;
    },

    isInProgress: function () {
      return instance.selection.inProgress;
    },

    /**
     * Starts selection range on given td object
     * @param {Object} coords
     */
    setRangeStart: function (coords) {
      priv.selStart.coords(coords);
      selection.setRangeEnd(coords);
    },

    /**
     * Ends selection range on given td object
     * @param {Object} coords
     * @param {Boolean} [scrollToCell=true] If true, viewport will be scrolled to range end
     */
    setRangeEnd: function (coords, scrollToCell) {
      instance.selection.begin();

      priv.selEnd.coords(coords);
      if (!priv.settings.multiSelect) {
        priv.selStart.coords(coords);
      }

      //set up current selection
      instance.view.wt.selections.current.clear();
      instance.view.wt.selections.current.add(priv.selStart.arr());

      //set up area selection
      instance.view.wt.selections.area.clear();
      if (selection.isMultiple()) {
        instance.view.wt.selections.area.add(priv.selStart.arr());
        instance.view.wt.selections.area.add(priv.selEnd.arr());
      }

      //set up highlight
      if (priv.settings.currentRowClassName || priv.settings.currentColClassName) {
        instance.view.wt.selections.highlight.clear();
        instance.view.wt.selections.highlight.add(priv.selStart.arr());
        instance.view.wt.selections.highlight.add(priv.selEnd.arr());
      }

      //trigger handlers
      instance.PluginHooks.run("afterSelection", priv.selStart.row(), priv.selStart.col(), priv.selEnd.row(), priv.selEnd.col());
      instance.PluginHooks.run("afterSelectionByProp", priv.selStart.row(), datamap.colToProp(priv.selStart.col()), priv.selEnd.row(), datamap.colToProp(priv.selEnd.col()));

      if (scrollToCell !== false) {
        instance.view.scrollViewport(coords);

        instance.view.wt.draw(true); //these two lines are needed to fix scrolling viewport when cell dimensions are significantly bigger than assumed by Walkontable
        instance.view.scrollViewport(coords);
      }
      selection.refreshBorders();
    },

    /**
     * Destroys editor, redraws borders around cells, prepares editor
     * @param {Boolean} revertOriginal
     * @param {Boolean} keepEditor
     */
    refreshBorders: function (revertOriginal, keepEditor) {
      if (!keepEditor) {
        editproxy.destroy(revertOriginal);
      }
      instance.view.render();
      if (selection.isSelected() && !keepEditor) {
        editproxy.prepare();
      }
    },

    /**
     * Returns information if we have a multiselection
     * @return {Boolean}
     */
    isMultiple: function () {
      return !(priv.selEnd.col() === priv.selStart.col() && priv.selEnd.row() === priv.selStart.row());
    },

    /**
     * Selects cell relative to current cell (if possible)
     */
    transformStart: function (rowDelta, colDelta, force) {
      if (priv.selStart.row() + rowDelta > instance.countRows() - 1) {
        if (force && priv.settings.minSpareRows > 0) {
          instance.alter("insert_row", instance.countRows());
        }
        else if (priv.settings.autoWrapCol && priv.selStart.col() + colDelta < instance.countCols() - 1) {
          rowDelta = 1 - instance.countRows();
          colDelta = 1;
        }
      }
      else if (priv.settings.autoWrapCol && priv.selStart.row() + rowDelta < 0 && priv.selStart.col() + colDelta >= 0) {
        rowDelta = instance.countRows() - 1;
        colDelta = -1;
      }
      if (priv.selStart.col() + colDelta > instance.countCols() - 1) {
        if (force && priv.settings.minSpareCols > 0) {
          instance.alter("insert_col", instance.countCols());
        }
        else if (priv.settings.autoWrapRow && priv.selStart.row() + rowDelta < instance.countRows() - 1) {
          rowDelta = 1;
          colDelta = 1 - instance.countCols();
        }
      }
      else if (priv.settings.autoWrapRow && priv.selStart.col() + colDelta < 0 && priv.selStart.row() + rowDelta >= 0) {
        rowDelta = -1;
        colDelta = instance.countCols() - 1;
      }

      var totalRows = instance.countRows();
      var totalCols = instance.countCols();
      var coords = {
        row: (priv.selStart.row() + rowDelta),
        col: priv.selStart.col() + colDelta
      };

      if (coords.row < 0) {
        coords.row = 0;
      }
      else if (coords.row > 0 && coords.row >= totalRows) {
        coords.row = totalRows - 1;
      }

      if (coords.col < 0) {
        coords.col = 0;
      }
      else if (coords.col > 0 && coords.col >= totalCols) {
        coords.col = totalCols - 1;
      }

      selection.setRangeStart(coords);
    },

    /**
     * Sets selection end cell relative to current selection end cell (if possible)
     */
    transformEnd: function (rowDelta, colDelta) {
      if (priv.selEnd.exists()) {
        var totalRows = instance.countRows();
        var totalCols = instance.countCols();
        var coords = {
          row: priv.selEnd.row() + rowDelta,
          col: priv.selEnd.col() + colDelta
        };

        if (coords.row < 0) {
          coords.row = 0;
        }
        else if (coords.row > 0 && coords.row >= totalRows) {
          coords.row = totalRows - 1;
        }

        if (coords.col < 0) {
          coords.col = 0;
        }
        else if (coords.col > 0 && coords.col >= totalCols) {
          coords.col = totalCols - 1;
        }

        selection.setRangeEnd(coords);
      }
    },

    /**
     * Returns true if currently there is a selection on screen, false otherwise
     * @return {Boolean}
     */
    isSelected: function () {
      return priv.selEnd.exists();
    },

    /**
     * Returns true if coords is within current selection coords
     * @return {Boolean}
     */
    inInSelection: function (coords) {
      if (!selection.isSelected()) {
        return false;
      }
      var sel = grid.getCornerCoords([priv.selStart.coords(), priv.selEnd.coords()]);
      return (sel.TL.row <= coords.row && sel.BR.row >= coords.row && sel.TL.col <= coords.col && sel.BR.col >= coords.col);
    },

    /**
     * Deselects all selected cells
     */
    deselect: function () {
      if (!selection.isSelected()) {
        return;
      }
      instance.selection.inProgress = false; //needed by HT inception
      priv.selEnd = new Handsontable.SelectionPoint(); //create new empty point to remove the existing one
      instance.view.wt.selections.current.clear();
      instance.view.wt.selections.area.clear();
      editproxy.destroy();
      selection.refreshBorders();
      instance.PluginHooks.run('afterDeselect');
    },

    /**
     * Select all cells
     */
    selectAll: function () {
      if (!priv.settings.multiSelect) {
        return;
      }
      selection.setRangeStart({
        row: 0,
        col: 0
      });
      selection.setRangeEnd({
        row: instance.countRows() - 1,
        col: instance.countCols() - 1
      }, false);
    },

    /**
     * Deletes data from selected cells
     */
    empty: function () {
      if (!selection.isSelected()) {
        return;
      }
      var corners = grid.getCornerCoords([priv.selStart.coords(), priv.selEnd.coords()]);
      var r, c, changes = [];
      for (r = corners.TL.row; r <= corners.BR.row; r++) {
        for (c = corners.TL.col; c <= corners.BR.col; c++) {
          if (instance.getCellMeta(r, c).isWritable) {
            changes.push([r, c, '']);
          }
        }
      }
      instance.setDataAtCell(changes);
    }
  };

  this.autofill = autofill = { //this public assignment is only temporary
    handle: null,

    /**
     * Create fill handle and fill border objects
     */
    init: function () {
      if (!autofill.handle) {
        autofill.handle = {};
      }
      else {
        autofill.handle.disabled = false;
      }
    },

    /**
     * Hide fill handle and fill border permanently
     */
    disable: function () {
      autofill.handle.disabled = true;
    },

    /**
     * Selects cells down to the last row in the left column, then fills down to that cell
     */
    selectAdjacent: function () {
      var select, data, r, maxR, c;

      if (selection.isMultiple()) {
        select = instance.view.wt.selections.area.getCorners();
      }
      else {
        select = instance.view.wt.selections.current.getCorners();
      }

      data = datamap.getAll();
      rows : for (r = select[2] + 1; r < instance.countRows(); r++) {
        for (c = select[1]; c <= select[3]; c++) {
          if (data[r][c]) {
            break rows;
          }
        }
        if (!!data[r][select[1] - 1] || !!data[r][select[3] + 1]) {
          maxR = r;
        }
      }
      if (maxR) {
        instance.view.wt.selections.fill.clear();
        instance.view.wt.selections.fill.add([select[0], select[1]]);
        instance.view.wt.selections.fill.add([maxR, select[3]]);
        autofill.apply();
      }
    },

    /**
     * Apply fill values to the area in fill border, omitting the selection border
     */
    apply: function () {
      var drag, select, start, end, _data;

      autofill.handle.isDragged = 0;

      drag = instance.view.wt.selections.fill.getCorners();
      if (!drag) {
        return;
      }

      instance.view.wt.selections.fill.clear();

      if (selection.isMultiple()) {
        select = instance.view.wt.selections.area.getCorners();
      }
      else {
        select = instance.view.wt.selections.current.getCorners();
      }

      if (drag[0] === select[0] && drag[1] < select[1]) {
        start = {
          row: drag[0],
          col: drag[1]
        };
        end = {
          row: drag[2],
          col: select[1] - 1
        };
      }
      else if (drag[0] === select[0] && drag[3] > select[3]) {
        start = {
          row: drag[0],
          col: select[3] + 1
        };
        end = {
          row: drag[2],
          col: drag[3]
        };
      }
      else if (drag[0] < select[0] && drag[1] === select[1]) {
        start = {
          row: drag[0],
          col: drag[1]
        };
        end = {
          row: select[0] - 1,
          col: drag[3]
        };
      }
      else if (drag[2] > select[2] && drag[1] === select[1]) {
        start = {
          row: select[2] + 1,
          col: drag[1]
        };
        end = {
          row: drag[2],
          col: drag[3]
        };
      }

      if (start) {

        _data = SheetClip.parse(datamap.getText(priv.selStart.coords(), priv.selEnd.coords()));
        instance.PluginHooks.run('beforeAutofill', start, end, _data);

        grid.populateFromArray(start, _data, end, 'autofill');

        selection.setRangeStart({row: drag[0], col: drag[1]});
        selection.setRangeEnd({row: drag[2], col: drag[3]});
      }
      /*else {
       //reset to avoid some range bug
       selection.refreshBorders();
       }*/
    },

    /**
     * Show fill border
     */
    showBorder: function (coords) {
      coords.row = coords[0];
      coords.col = coords[1];

      var corners = grid.getCornerCoords([priv.selStart.coords(), priv.selEnd.coords()]);
      if (priv.settings.fillHandle !== 'horizontal' && (corners.BR.row < coords.row || corners.TL.row > coords.row)) {
        coords = [coords.row, corners.BR.col];
      }
      else if (priv.settings.fillHandle !== 'vertical') {
        coords = [corners.BR.row, coords.col];
      }
      else {
        return; //wrong direction
      }

      instance.view.wt.selections.fill.clear();
      instance.view.wt.selections.fill.add([priv.selStart.coords().row, priv.selStart.coords().col]);
      instance.view.wt.selections.fill.add([priv.selEnd.coords().row, priv.selEnd.coords().col]);
      instance.view.wt.selections.fill.add(coords);
      instance.view.render();
    }
  };

  editproxy = { //this public assignment is only temporary
    /**
     * Create input field
     */
    init: function () {
      priv.onCut = function onCut() {
        if (Handsontable.activeGuid !== instance.guid) {
          return;
        }

        selection.empty();
      };

      priv.onPaste = function onPaste(str) {
        if (Handsontable.activeGuid !== instance.guid) {
          return;
        }

        var input = str.replace(/^[\r\n]*/g, '').replace(/[\r\n]*$/g, '') //remove newline from the start and the end of the input
          , inputArray = SheetClip.parse(input)
          , coords = grid.getCornerCoords([priv.selStart.coords(), priv.selEnd.coords()])
          , areaStart = coords.TL
          , areaEnd = {
            row: Math.max(coords.BR.row, inputArray.length - 1 + coords.TL.row),
            col: Math.max(coords.BR.col, inputArray[0].length - 1 + coords.TL.col)
          };

        instance.PluginHooks.once('afterChange', function (changes, source) {
          if (changes && changes.length) {
            instance.selectCell(areaStart.row, areaStart.col, areaEnd.row, areaEnd.col);
          }
        });

        grid.populateFromArray(areaStart, inputArray, areaEnd, 'paste', priv.settings.pasteMode);
      };

      function onKeyDown(event) {
        if (Handsontable.activeGuid !== instance.guid) {
          return;
        }

        if (priv.settings.beforeOnKeyDown) { // HOT in HOT Plugin
          priv.settings.beforeOnKeyDown.call(instance, event);
        }

        if ($body.children('.context-menu-list:visible').length) {
          return;
        }

        if (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93) {
          //when CTRL is pressed, prepare selectable text in textarea
          //http://stackoverflow.com/questions/3902635/how-does-one-capture-a-macs-command-key-via-javascript
          editproxy.setCopyableText();
          return;
        }

        priv.lastKeyCode = event.keyCode;
        if (selection.isSelected()) {
          var ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey; //catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
          if (Handsontable.helper.isPrintableChar(event.keyCode) && ctrlDown) {
            if (event.keyCode === 65) { //CTRL + A
              selection.selectAll(); //select all cells
              editproxy.setCopyableText();
              event.preventDefault();
            }
            else if (event.keyCode === 89 || (event.shiftKey && event.keyCode === 90)) { //CTRL + Y or CTRL + SHIFT + Z
              priv.undoRedo && priv.undoRedo.redo();
            }
            else if (event.keyCode === 90) { //CTRL + Z
              priv.undoRedo && priv.undoRedo.undo();
            }
            return;
          }

          var rangeModifier = event.shiftKey ? selection.setRangeEnd : selection.setRangeStart;

          instance.PluginHooks.run('beforeKeyDown', event);
          if (!event.isImmediatePropagationStopped()) {

            switch (event.keyCode) {
              case 38: /* arrow up */
                if (event.shiftKey) {
                  selection.transformEnd(-1, 0);
                }
                else {
                  selection.transformStart(-1, 0);
                }
                event.preventDefault();
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 9: /* tab */
                var tabMoves = typeof priv.settings.tabMoves === 'function' ? priv.settings.tabMoves(event) : priv.settings.tabMoves;
                if (event.shiftKey) {
                  selection.transformStart(-tabMoves.row, -tabMoves.col); //move selection left
                }
                else {
                  selection.transformStart(tabMoves.row, tabMoves.col, true); //move selection right (add a new column if needed)
                }
                event.preventDefault();
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 39: /* arrow right */
                if (event.shiftKey) {
                  selection.transformEnd(0, 1);
                }
                else {
                  selection.transformStart(0, 1);
                }
                event.preventDefault();
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 37: /* arrow left */
                if (event.shiftKey) {
                  selection.transformEnd(0, -1);
                }
                else {
                  selection.transformStart(0, -1);
                }
                event.preventDefault();
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 8: /* backspace */
              case 46: /* delete */
                selection.empty(event);
                event.preventDefault();
                break;

              case 40: /* arrow down */
                if (event.shiftKey) {
                  selection.transformEnd(1, 0); //expanding selection down with shift
                }
                else {
                  selection.transformStart(1, 0); //move selection down
                }
                event.preventDefault();
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 113: /* F2 */
                event.preventDefault(); //prevent Opera from opening Go to Page dialog
                break;

              case 13: /* return/enter */
                var enterMoves = typeof priv.settings.enterMoves === 'function' ? priv.settings.enterMoves(event) : priv.settings.enterMoves;

                if (event.shiftKey) {
                  selection.transformStart(-enterMoves.row, -enterMoves.col); //move selection up
                }
                else {
                  selection.transformStart(enterMoves.row, enterMoves.col, true); //move selection down (add a new row if needed)
                }

                event.preventDefault(); //don't add newline to field
                break;

              case 36: /* home */
                if (event.ctrlKey || event.metaKey) {
                  rangeModifier({row: 0, col: priv.selStart.col()});
                }
                else {
                  rangeModifier({row: priv.selStart.row(), col: 0});
                }
                event.preventDefault(); //don't scroll the window
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 35: /* end */
                if (event.ctrlKey || event.metaKey) {
                  rangeModifier({row: instance.countRows() - 1, col: priv.selStart.col()});
                }
                else {
                  rangeModifier({row: priv.selStart.row(), col: instance.countCols() - 1});
                }
                event.preventDefault(); //don't scroll the window
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 33: /* pg up */
                selection.transformStart(-instance.countVisibleRows(), 0);
                instance.view.wt.scrollVertical(-instance.countVisibleRows());
                instance.view.render();
                event.preventDefault(); //don't page up the window
                event.stopPropagation(); //required by HandsontableEditor
                break;

              case 34: /* pg down */
                selection.transformStart(instance.countVisibleRows(), 0);
                instance.view.wt.scrollVertical(instance.countVisibleRows());
                instance.view.render();
                event.preventDefault(); //don't page down the window
                event.stopPropagation(); //required by HandsontableEditor
                break;

              default:
                break;
            }

          }
        }
      }

      instance.copyPaste = CopyPaste.getInstance();
      instance.copyPaste.onCut(priv.onCut);
      instance.copyPaste.onPaste(priv.onPaste);
      $document.on('keydown.handsontable.' + instance.guid, onKeyDown);
    },

    /**
     * Destroy current editor, if exists
     * @param {Boolean} revertOriginal
     */
    destroy: function (revertOriginal) {
      if (typeof priv.editorDestroyer === "function") {
        var destroyer = priv.editorDestroyer; //this copy is needed, otherwise destroyer can enter an infinite loop
        priv.editorDestroyer = null;
        destroyer(revertOriginal);
      }
    },

    /**
     * Prepares copyable text in the invisible textarea
     */
    setCopyableText: function () {
      var startRow = Math.min(priv.selStart.row(), priv.selEnd.row());
      var startCol = Math.min(priv.selStart.col(), priv.selEnd.col());
      var endRow = Math.max(priv.selStart.row(), priv.selEnd.row());
      var endCol = Math.max(priv.selStart.col(), priv.selEnd.col());
      var finalEndRow = Math.min(endRow, startRow + priv.settings.copyRowsLimit - 1);
      var finalEndCol = Math.min(endCol, startCol + priv.settings.copyColsLimit - 1);

      instance.copyPaste.copyable(datamap.getText({row: startRow, col: startCol}, {row: finalEndRow, col: finalEndCol}));

      if (endRow !== finalEndRow || endCol !== finalEndCol) {
        instance.PluginHooks.run("afterCopyLimit", endRow - startRow + 1, endCol - startCol + 1, priv.settings.copyRowsLimit, priv.settings.copyColsLimit);
      }
    },

    /**
     * Prepare text input to be displayed at given grid cell
     */
    prepare: function () {
      if (!instance.getCellMeta(priv.selStart.row(), priv.selStart.col()).isWritable) {
        return;
      }

      instance.listen();
      var TD = instance.view.getCellAtCoords(priv.selStart.coords());
      priv.editorDestroyer = instance.view.applyCellTypeMethod('editor', TD, priv.selStart.row(), priv.selStart.col());
      //presumably TD can be removed from here. Cell editor should also listen for changes if editable cell is outside from viewport
    }
  };

  this.init = function () {
    instance.PluginHooks.run('beforeInit');
    editproxy.init();

    this.updateSettings(priv.settings, true);
    this.parseSettingsFromDOM();
    this.view = new Handsontable.TableView(this);

    this.forceFullRender = true; //used when data was changed
    this.view.render();

    if (typeof priv.firstRun === 'object') {
      instance.PluginHooks.run('afterChange', priv.firstRun[0], priv.firstRun[1]);
      priv.firstRun = false;
    }
    instance.PluginHooks.run('afterInit');
  };

  function validateChanges(changes, source, callback) {
    var waitingForValidator = 0;

    for (var i = changes.length - 1; i >= 0; i--) {
      if (changes[i] === null) {
        changes.splice(i, 1);
      }
      else {
        var cellProperties = instance.getCellMeta(changes[i][0], datamap.propToCol(changes[i][1]));

        if (cellProperties.dataType === 'number' && typeof changes[i][3] === 'string') {
          if (changes[i][3].length > 0 && /^-?[\d\s]*\.?\d*$/.test(changes[i][3])) {
            changes[i][3] = numeral().unformat(changes[i][3] || '0'); //numeral cannot unformat empty string
          }
        }

        if (cellProperties.validator) {
          waitingForValidator++;
          instance.validateCell(changes[i][3], cellProperties, (function (i, cellProperties) {
            return function (result) {
              if (typeof result !== 'boolean') {
                throw new Error("Validation error: result is not boolean");
              }
              if (result === false && cellProperties.allowInvalid === false) {
                changes.splice(i, 1);
                --i;
              }
              waitingForValidator--;
              resolve();
            }
          })(i, cellProperties)
            , source);
        }
      }
    }
    resolve();

    function resolve() {
      var beforeChangeResult;
      if (waitingForValidator === 0) {
        if (changes.length) {
          beforeChangeResult = instance.PluginHooks.execute("beforeChange", changes, source);
          if (typeof beforeChangeResult === 'function') {
            $.when(result).then(function () {
              callback(); //called when async validators and async beforeChange are resolved
            });
          }
          else if (beforeChangeResult === false) {
            changes.splice(0, changes.length); //invalidate all changes (remove everything from array)
          }
        }
        if (typeof beforeChangeResult !== 'function') {
          callback(); //called when async validators are resolved and beforeChange was not async
        }
      }
    }
  }

  /**
   * Internal function to apply changes. Called after validateChanges
   * @param {Array} changes Array in form of [row, prop, oldValue, newValue]
   * @param {String} source String that identifies how this change will be described in changes array (useful in onChange callback)
   */
  function applyChanges(changes, source) {
    var i = changes.length - 1;

    if (i < 0) {
      return;
    }

    for (; 0 <= i; i--) {
      if (changes[i] === null) {
        changes.splice(i, 1);
        continue;
      }

      if (priv.settings.minSpareRows) {
        while (changes[i][0] > instance.countRows() - 1) {
          datamap.createRow();
        }
      }

      if (priv.dataType === 'array' && priv.settings.minSpareCols) {
        while (datamap.propToCol(changes[i][1]) > instance.countCols() - 1) {
          datamap.createCol();
        }
      }

      datamap.set(changes[i][0], changes[i][1], changes[i][3]);
    }

    instance.forceFullRender = true; //used when data was changed
    grid.adjustRowsAndCols();
    selection.refreshBorders();
    instance.PluginHooks.run('afterChange', changes, source || 'edit');
  }

  this.validateCell = function (value, cellProperties, callback, source) {
    var validator = cellProperties.validator;

    if (Object.prototype.toString.call(validator) === '[object RegExp]') {
      validator = (function (validator) {
        return function (value, callback) {
          callback(validator.test(value));
        }
      })(validator);
    }

    if (typeof validator === 'function') {
      value = instance.PluginHooks.execute("beforeValidate", value, cellProperties.row, cellProperties.prop, source);

      validator.call(cellProperties, value, function (valid) {
        if (cellProperties.allowInvalid) {
          cellProperties.valid = valid;
        }
        valid = instance.PluginHooks.execute("afterValidate", valid, value, cellProperties.row, cellProperties.prop, source);
        callback(valid);
      });
    }
  };

  function setDataInputToArray(row, prop_or_col, value) {
    if (typeof row === "object") { //is it an array of changes
      return row;
    }
    else if ($.isPlainObject(value)) { //backwards compatibility
      return value;
    }
    else {
      return [
        [row, prop_or_col, value]
      ];
    }
  }

  /**
   * Set data at given cell
   * @public
   * @param {Number|Array} row or array of changes in format [[row, col, value], ...]
   * @param {Number|String} col or source String
   * @param {String} value
   * @param {String} source String that identifies how this change will be described in changes array (useful in onChange callback)
   */
  this.setDataAtCell = function (row, col, value, source) {
    var input = setDataInputToArray(row, col, value)
      , i
      , ilen
      , changes = []
      , prop;

    for (i = 0, ilen = input.length; i < ilen; i++) {
      if (typeof input[i] !== 'object') {
        throw new Error('Method `setDataAtCell` accepts row number or changes array of arrays as its first parameter');
      }
      if (typeof input[i][1] !== 'number') {
        throw new Error('Method `setDataAtCell` accepts row and column number as its parameters. If you want to use object property name, use method `setDataAtRowProp`');
      }
      prop = datamap.colToProp(input[i][1]);
      changes.push([
        input[i][0],
        prop,
        datamap.get(input[i][0], prop),
        input[i][2]
      ]);
    }

    if (!source && typeof row === "object") {
      source = col;
    }

    validateChanges(changes, source, function () {
      applyChanges(changes, source);
    });
  };


  /**
   * Set data at given row property
   * @public
   * @param {Number|Array} row or array of changes in format [[row, prop, value], ...]
   * @param {String} prop or source String
   * @param {String} value
   * @param {String} source String that identifies how this change will be described in changes array (useful in onChange callback)
   */
  this.setDataAtRowProp = function (row, prop, value, source) {
    var input = setDataInputToArray(row, prop, value)
      , i
      , ilen
      , changes = [];

    for (i = 0, ilen = input.length; i < ilen; i++) {
      changes.push([
        input[i][0],
        input[i][1],
        datamap.get(input[i][0], input[i][1]),
        input[i][2]
      ]);
    }

    if (!source && typeof row === "object") {
      source = prop;
    }

    validateChanges(changes, source, function () {
      applyChanges(changes, source);
    });
  };

  /**
   * Listen to keyboard input
   */
  this.listen = function () {
    Handsontable.activeGuid = instance.guid;

    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    else if (!document.activeElement) { //IE
      document.body.focus();
    }
  };

  /**
   * Destroys current editor, renders and selects current cell. If revertOriginal != true, edited data is saved
   * @param {Boolean} revertOriginal
   */
  this.destroyEditor = function (revertOriginal) {
    selection.refreshBorders(revertOriginal);
  };

  /**
   * Populate cells at position with 2d array
   * @param {Number} row Start row
   * @param {Number} col Start column
   * @param {Array} input 2d array
   * @param {Number=} endRow End row (use when you want to cut input when certain row is reached)
   * @param {Number=} endCol End column (use when you want to cut input when certain column is reached)
   * @param {String=} [source="populateFromArray"]
   * @param {String=} [method="overwrite"]
   * @return {Object|undefined} ending td in pasted area (only if any cell was changed)
   */
  this.populateFromArray = function (row, col, input, endRow, endCol, source, method) {
    if (typeof input !== 'object') {
      throw new Error("populateFromArray parameter `input` must be an array"); //API changed in 0.9-beta2, let's check if you use it correctly
    }
    return grid.populateFromArray({row: row, col: col}, input, typeof endRow === 'number' ? {row: endRow, col: endCol} : null, source, method);
  };

  /**
   * Adds/removes data from the column
   * @param {Number} col Index of column in which do you want to do splice.
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed
   * param {...*} elements Optional. The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array
   */
  this.spliceCol = function (col, index, amount/*, elements... */) {
    return datamap.spliceCol.apply(null, arguments);
  };

  /**
   * Adds/removes data from the row
   * @param {Number} row Index of column in which do you want to do splice.
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed
   * param {...*} elements Optional. The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array
   */
  this.spliceRow = function (row, index, amount/*, elements... */) {
    return datamap.spliceRow.apply(null, arguments);
  };

  /**
   * Returns the top left (TL) and bottom right (BR) selection coordinates
   * @param {Object[]} coordsArr
   * @returns {Object}
   */
  this.getCornerCoords = function (coordsArr) {
    return grid.getCornerCoords(coordsArr);
  };

  /**
   * Returns current selection. Returns undefined if there is no selection.
   * @public
   * @return {Array} [`startRow`, `startCol`, `endRow`, `endCol`]
   */
  this.getSelected = function () { //https://github.com/warpech/jquery-handsontable/issues/44  //cjl
    if (selection.isSelected()) {
      return [priv.selStart.row(), priv.selStart.col(), priv.selEnd.row(), priv.selEnd.col()];
    }
  };

  /**
   * Parse settings from DOM and CSS
   * @public
   */
  this.parseSettingsFromDOM = function () {
    var overflow = this.rootElement.css('overflow');
    if (overflow === 'scroll' || overflow === 'auto') {
      this.rootElement[0].style.overflow = 'visible';
      priv.settingsFromDOM.overflow = overflow;
    }
    else if (priv.settings.width === void 0 || priv.settings.height === void 0) {
      priv.settingsFromDOM.overflow = 'auto';
    }

    if (priv.settings.width === void 0) {
      priv.settingsFromDOM.width = this.rootElement.width();
    }
    else {
      priv.settingsFromDOM.width = void 0;
    }

    priv.settingsFromDOM.height = void 0;
    if (priv.settings.height === void 0) {
      if (priv.settingsFromDOM.overflow === 'scroll' || priv.settingsFromDOM.overflow === 'auto') {
        //this needs to read only CSS/inline style and not actual height
        //so we need to call getComputedStyle on cloned container
        var clone = this.rootElement[0].cloneNode(false);
        var parent = this.rootElement[0].parentNode;
        if (parent) {
          clone.removeAttribute('id');
          parent.appendChild(clone);
          var computedHeight = parseInt(window.getComputedStyle(clone, null).getPropertyValue('height'), 10);
          if (computedHeight > 0) {
            priv.settingsFromDOM.height = computedHeight;
          }
          parent.removeChild(clone);
        }
      }
    }
  };

  /**
   * Render visible data
   * @public
   */
  this.render = function () {
    if (instance.view) {
      priv.cellSettings.length = 0; //clear cellSettings cache
      instance.forceFullRender = true; //used when data was changed
      instance.parseSettingsFromDOM();
      selection.refreshBorders(null, true);
    }
  };

  /**
   * Load data from array
   * @public
   * @param {Array} data
   */
  this.loadData = function (data) {
    if (!(data.push && data.splice)) { //check if data is array. Must use duck-type check so Backbone Collections also pass it
      throw new Error("loadData only accepts array of objects or array of arrays (" + typeof data + " given)");
    }

    priv.isPopulated = false;
    GridSettings.prototype.data = data;

    if (priv.settings.dataSchema instanceof Array || data[0]  instanceof Array) {
      priv.dataType = 'array';
    }
    else if ($.isFunction(priv.settings.dataSchema)) {
      priv.dataType = 'function';
    }
    else {
      priv.dataType = 'object';
    }

    if (data[0]) {
      priv.duckDataSchema = datamap.recursiveDuckSchema(data[0]);
    }
    else {
      priv.duckDataSchema = {};
    }
    datamap.createMap();

    grid.adjustRowsAndCols();
    instance.PluginHooks.run('afterLoadData');

    if (priv.firstRun) {
      priv.firstRun = [null, 'loadData'];
    }
    else {
      instance.PluginHooks.run('afterChange', null, 'loadData');
      instance.render();
    }
    priv.isPopulated = true;
    instance.clearUndo();
  };

  /**
   * Return the current data object (the same that was passed by `data` configuration option or `loadData` method). Optionally you can provide cell range `r`, `c`, `r2`, `c2` to get only a fragment of grid data
   * @public
   * @param {Number} r (Optional) From row
   * @param {Number} c (Optional) From col
   * @param {Number} r2 (Optional) To row
   * @param {Number} c2 (Optional) To col
   * @return {Array|Object}
   */
  this.getData = function (r, c, r2, c2) {
    if (typeof r === 'undefined') {
      return datamap.getAll();
    }
    else {
      return datamap.getRange({row: r, col: c}, {row: r2, col: c2});
    }
  };

  /**
   * Update settings
   * @public
   */
  this.updateSettings = function (settings, init) {
    var i, r, rlen, c, clen;

    if (typeof settings.rows !== "undefined") {
      throw new Error("'rows' setting is no longer supported. do you mean startRows, minRows or maxRows?");
    }
    if (typeof settings.cols !== "undefined") {
      throw new Error("'cols' setting is no longer supported. do you mean startCols, minCols or maxCols?");
    }

    if (typeof settings.undo !== "undefined") {
      if (priv.undoRedo && settings.undo === false) {
        priv.undoRedo = null;
      }
      else if (!priv.undoRedo && settings.undo === true) {
        priv.undoRedo = new Handsontable.UndoRedo(instance);
      }
    }

    for (i in settings) {
      if (i === 'data') {
        continue; //loadData will be triggered later
      }
      else {
        if (instance.PluginHooks.hooks.persistent[i] !== void 0 || instance.PluginHooks.legacy[i] !== void 0) {
          instance.PluginHooks.add(i, settings[i]);
        }
        else {
          // Update settings
          if (!init && settings.hasOwnProperty(i)) {
            GridSettings.prototype[i] = settings[i];
          }

          //launch extensions
          if (Handsontable.extension[i]) {
            priv.extensions[i] = new Handsontable.extension[i](instance, settings[i]);
          }
        }
      }
    }

    // Load data or create data map
    if (settings.data === void 0 && priv.settings.data === void 0) {
      var data = [];
      var row;
      for (r = 0, rlen = priv.settings.startRows; r < rlen; r++) {
        row = [];
        for (c = 0, clen = priv.settings.startCols; c < clen; c++) {
          row.push(null);
        }
        data.push(row);
      }
      instance.loadData(data); //data source created just now
    }
    else if (settings.data !== void 0) {
      instance.loadData(settings.data); //data source given as option
    }
    else if (settings.columns !== void 0) {
      datamap.createMap();
    }

    // Init columns constructors configuration
    clen = instance.countCols();

    //Clear cellSettings cache
    priv.cellSettings.length = 0;

    if (clen > 0) {
      var prop, proto, column;

      for (i = 0; i < clen; i++) {
        priv.columnSettings[i] = Handsontable.helper.columnFactory(GridSettings, priv.columnsSettingConflicts, Handsontable.TextCell);

        // shortcut for prototype
        proto = priv.columnSettings[i].prototype;

        // Use settings provided by user
        if (GridSettings.prototype.columns) {
          column = GridSettings.prototype.columns[i];
          for (prop in column) {
            if (column.hasOwnProperty(prop)) {
              proto[prop] = column[prop];
            }
          }
        }
      }
    }

    if (typeof settings.fillHandle !== "undefined") {
      if (autofill.handle && settings.fillHandle === false) {
        autofill.disable();
      }
      else if (!autofill.handle && settings.fillHandle !== false) {
        autofill.init();
      }
    }

    grid.adjustRowsAndCols();
    if (instance.view) {
      instance.forceFullRender = true; //used when data was changed
      selection.refreshBorders(null, true);
    }
  };

  /**
   * Returns current settings object
   * @return {Object}
   */
  this.getSettings = function () {
    return priv.settings;
  };

  /**
   * Returns current settingsFromDOM object
   * @return {Object}
   */
  this.getSettingsFromDOM = function () {
    return priv.settingsFromDOM;
  };

  /**
   * Clears grid
   * @public
   */
  this.clear = function () {
    selection.selectAll();
    selection.empty();
  };

  /**
   * Return true if undo can be performed, false otherwise
   * @public
   */
  this.isUndoAvailable = function () {
    return priv.undoRedo && priv.undoRedo.isUndoAvailable();
  };

  /**
   * Return true if redo can be performed, false otherwise
   * @public
   */
  this.isRedoAvailable = function () {
    return priv.undoRedo && priv.undoRedo.isRedoAvailable();
  };

  /**
   * Undo last edit
   * @public
   */
  this.undo = function () {
    priv.undoRedo && priv.undoRedo.undo();
  };

  /**
   * Redo edit (used to reverse an undo)
   * @public
   */
  this.redo = function () {
    priv.undoRedo && priv.undoRedo.redo();
  };

  /**
   * Clears undo history
   * @public
   */
  this.clearUndo = function () {
    priv.undoRedo && priv.undoRedo.clear();
  };

  /**
   * Inserts or removes rows and columns
   * @param {String} action See grid.alter for possible values
   * @param {Number} index
   * @param {Number} amount
   * @param {String} [source] Optional. Source of hook runner.
   * @param {Boolean} [keepEmptyRows] Optional. Flag for preventing deletion of empty rows.
   * @public
   */
  this.alter = function (action, index, amount, source, keepEmptyRows) {
    grid.alter(action, index, amount, source, keepEmptyRows);
  };

  /**
   * Returns <td> element corresponding to params row, col
   * @param {Number} row
   * @param {Number} col
   * @public
   * @return {Element}
   */
  this.getCell = function (row, col) {
    return instance.view.getCellAtCoords({row: row, col: col});
  };

  /**
   * Returns property name associated with column number
   * @param {Number} col
   * @public
   * @return {String}
   */
  this.colToProp = function (col) {
    return datamap.colToProp(col);
  };

  /**
   * Returns column number associated with property name
   * @param {String} prop
   * @public
   * @return {Number}
   */
  this.propToCol = function (prop) {
    return datamap.propToCol(prop);
  };

  /**
   * Return value at `row`, `col`
   * @param {Number} row
   * @param {Number} col
   * @public
   * @return value (mixed data type)
   */
  this.getDataAtCell = function (row, col) {
    return datamap.get(row, datamap.colToProp(col));
  };

  /**
   * Return value at `row`, `prop`
   * @param {Number} row
   * @param {String} prop
   * @public
   * @return value (mixed data type)
   */
  this.getDataAtRowProp = function (row, prop) {
    return datamap.get(row, prop);
  };

  /**
   * Return value at `col`
   * @param {Number} col
   * @public
   * @return value (mixed data type)
   */
  this.getDataAtCol = function (col) {
    return [].concat.apply([], datamap.getRange({row: 0, col: col}, {row: priv.settings.data.length - 1, col: col}));
  };

  /**
   * Return value at `prop`
   * @param {String} prop
   * @public
   * @return value (mixed data type)
   */
  this.getDataAtProp = function (prop) {
    return [].concat.apply([], datamap.getRange({row: 0, col: datamap.propToCol(prop)}, {row: priv.settings.data.length - 1, col: datamap.propToCol(prop)}));
  };

  /**
   * Return value at `row`
   * @param {Number} row
   * @public
   * @return value (mixed data type)
   */
  this.getDataAtRow = function (row) {
    return priv.settings.data[row];
  };

  /**
   * Returns cell meta data object corresponding to params row, col
   * @param {Number} row
   * @param {Number} col
   * @public
   * @return {Object}
   */
  this.getCellMeta = function (row, col) {
    var prop = datamap.colToProp(col)
      , cellProperties
      , type
      , i;

    col = Handsontable.PluginHooks.execute(instance, 'modifyCol', col); //translate col of a moved column. warning: this must be done after datamap.colToProp

    if ("undefined" === typeof priv.columnSettings[col]) {
      priv.columnSettings[col] = Handsontable.helper.columnFactory(GridSettings, priv.columnsSettingConflicts, Handsontable.TextCell);
    }

    if (!priv.cellSettings[row]) {
      priv.cellSettings[row] = {}
    }
    if (!priv.cellSettings[row][col]) {
      priv.cellSettings[row][col] = new priv.columnSettings[col]();
    }

    cellProperties = priv.cellSettings[row][col]; //retrieve cellProperties from cache

    cellProperties.row = row;
    cellProperties.col = col;
    cellProperties.prop = prop;
    cellProperties.instance = instance;

    if (cellProperties.cells) {
      var settings = cellProperties.cells.call(cellProperties, row, col, prop) || {}
        , key;

      for (key in settings) {
        if (settings.hasOwnProperty(key)) {
          cellProperties[key] = settings[key];
        }
      }
    }

    cellProperties.isWritable = !cellProperties.readOnly;

    instance.PluginHooks.run('beforeGetCellMeta', row, col, cellProperties);

    if (typeof cellProperties.type === 'string' && cellProperties.type !== 'text') {
      type = Handsontable.cellTypes[cellProperties.type];
      if (type === void 0) {
        throw new Error('You declared cell type "' + cellProperties.type + '" as a string that is not mapped to a known object. Cell type must be an object or a string mapped to an object in Handsontable.cellTypes');
      }
    }
    else if (typeof cellProperties.type === 'object') {
      type = cellProperties.type;
    }

    if (type) {
      for (i in type) {
        if (type.hasOwnProperty(i) && cellProperties[i] === Handsontable.cellTypes.text[i]) {
          cellProperties[i] = type[i];
        }
      }
    }

    if (cellProperties.validator && cellProperties.valid === void 0) { //this is the first render of this cell and we need to know if it's valid
      instance.validateCell(instance.getDataAtCell(row, col), cellProperties, function (res) {
      }, 'getCellMeta');
    }

    instance.PluginHooks.run('afterGetCellMeta', row, col, cellProperties);

    return cellProperties;
  };

  /**
   * Return array of row headers (if they are enabled). If param `row` given, return header at given row as string
   * @param {Number} row (Optional)
   * @return {Array|String}
   */
  this.getRowHeader = function (row) {
    if (row === void 0) {
      var out = [];
      for (var i = 0, ilen = instance.countRows(); i < ilen; i++) {
        out.push(instance.getRowHeader(i));
      }
      return out;
    }
    else if (Object.prototype.toString.call(priv.settings.rowHeaders) === '[object Array]' && priv.settings.rowHeaders[row] !== void 0) {
      return priv.settings.rowHeaders[row];
    }
    else if (typeof priv.settings.rowHeaders === 'function') {
      return priv.settings.rowHeaders(row);
    }
    else if (priv.settings.rowHeaders && typeof priv.settings.rowHeaders !== 'string' && typeof priv.settings.rowHeaders !== 'number') {
      return row + 1;
    }
    else {
      return priv.settings.rowHeaders;
    }
  };

  /**
   * Return array of column headers (if they are enabled). If param `col` given, return header at given column as string
   * @param {Number} col (Optional)
   * @return {Array|String}
   */
  this.getColHeader = function (col) {
    if (col === void 0) {
      var out = [];
      for (var i = 0, ilen = instance.countCols(); i < ilen; i++) {
        out.push(instance.getColHeader(i));
      }
      return out;
    }
    else {
      col = Handsontable.PluginHooks.execute(instance, 'modifyCol', col);

      if (priv.settings.columns && priv.settings.columns[col] && priv.settings.columns[col].title) {
        return priv.settings.columns[col].title;
      }
      else if (Object.prototype.toString.call(priv.settings.colHeaders) === '[object Array]' && priv.settings.colHeaders[col] !== void 0) {
        return priv.settings.colHeaders[col];
      }
      else if (typeof priv.settings.colHeaders === 'function') {
        return priv.settings.colHeaders(col);
      }
      else if (priv.settings.colHeaders && typeof priv.settings.colHeaders !== 'string' && typeof priv.settings.colHeaders !== 'number') {
        return Handsontable.helper.spreadsheetColumnLabel(col);
      }
      else {
        return priv.settings.colHeaders;
      }
    }
  };

  /**
   * Return column width
   * @param {Number} col
   * @return {Number}
   */
  this.getColWidth = function (col) {
    col = Handsontable.PluginHooks.execute(instance, 'modifyCol', col);
    var response = {};
    if (priv.settings.columns && priv.settings.columns[col] && priv.settings.columns[col].width) {
      response.width = priv.settings.columns[col].width;
    }
    else if (Object.prototype.toString.call(priv.settings.colWidths) === '[object Array]' && priv.settings.colWidths[col] !== void 0) {
      response.width = priv.settings.colWidths[col];
    }
    else {
      response.width = 50;
    }
    instance.PluginHooks.run('afterGetColWidth', col, response);
    return response.width;
  };

  /**
   * Return total number of rows in grid
   * @return {Number}
   */
  this.countRows = function () {
    return priv.settings.data.length;
  };

  /**
   * Return total number of columns in grid
   * @return {Number}
   */
  this.countCols = function () {
    if (priv.dataType === 'object' || priv.dataType === 'function') {
      if (priv.settings.columns && priv.settings.columns.length) {
        return priv.settings.columns.length;
      }
      else {
        return priv.colToProp.length;
      }
    }
    else if (priv.dataType === 'array') {
      if (priv.settings.columns && priv.settings.columns.length) {
        return priv.settings.columns.length;
      }
      else if (priv.settings.data && priv.settings.data[0] && priv.settings.data[0].length) {
        return priv.settings.data[0].length;
      }
      else {
        return 0;
      }
    }
  };

  /**
   * Return index of first visible row
   * @return {Number}
   */
  this.rowOffset = function () {
    return instance.view.wt.getSetting('offsetRow');
  };

  /**
   * Return index of first visible column
   * @return {Number}
   */
  this.colOffset = function () {
    return instance.view.wt.getSetting('offsetColumn');
  };

  /**
   * Return number of visible rows. Returns -1 if table is not visible
   * @return {Number}
   */
  this.countVisibleRows = function () {
    return instance.view.wt.drawn ? instance.view.wt.wtTable.rowStrategy.countVisible() : -1;
  };

  /**
   * Return number of visible columns. Returns -1 if table is not visible
   * @return {Number}
   */
  this.countVisibleCols = function () {
    return instance.view.wt.drawn ? instance.view.wt.wtTable.columnStrategy.countVisible() : -1;
  };

  /**
   * Return number of empty rows
   * @return {Boolean} ending If true, will only count empty rows at the end of the data source
   */
  this.countEmptyRows = function (ending) {
    var i = instance.countRows() - 1
      , empty = 0;
    while (i >= 0) {
      if (instance.isEmptyRow(i)) {
        empty++;
      }
      else if (ending) {
        break;
      }
      i--;
    }
    return empty;
  };

  /**
   * Return number of empty columns
   * @return {Boolean} ending If true, will only count empty columns at the end of the data source row
   */
  this.countEmptyCols = function (ending) {
    if (instance.countRows() < 1) {
      return 0;
    }

    var i = instance.countCols() - 1
      , empty = 0;
    while (i >= 0) {
      if (instance.isEmptyCol(i)) {
        empty++;
      }
      else if (ending) {
        break;
      }
      i--;
    }
    return empty;
  };

  /**
   * Return true if the row at the given index is empty, false otherwise
   * @param {Number} r Row index
   * @return {Boolean}
   */
  this.isEmptyRow = function (r) {
    if (priv.settings.isEmptyRow) {
      return priv.settings.isEmptyRow.call(instance, r);
    }

    var val;
    for (var c = 0, clen = instance.countCols(); c < clen; c++) {
      val = instance.getDataAtCell(r, c);
      if (val !== '' && val !== null && typeof val !== 'undefined') {
        return false;
      }
    }
    return true;
  };

  /**
   * Return true if the column at the given index is empty, false otherwise
   * @param {Number} c Column index
   * @return {Boolean}
   */
  this.isEmptyCol = function (c) {
    if (priv.settings.isEmptyCol) {
      return priv.settings.isEmptyCol.call(instance, c);
    }

    var val;
    for (var r = 0, rlen = instance.countRows(); r < rlen; r++) {
      val = instance.getDataAtCell(r, c);
      if (val !== '' && val !== null && typeof val !== 'undefined') {
        return false;
      }
    }
    return true;
  };

  /**
   * Selects cell on grid. Optionally selects range to another cell
   * @param {Number} row
   * @param {Number} col
   * @param {Number} [endRow]
   * @param {Number} [endCol]
   * @param {Boolean} [scrollToCell=true] If true, viewport will be scrolled to the selection
   * @public
   * @return {Boolean}
   */
  this.selectCell = function (row, col, endRow, endCol, scrollToCell) {
    if (typeof row !== 'number' || row < 0 || row >= instance.countRows()) {
      return false;
    }
    if (typeof col !== 'number' || col < 0 || col >= instance.countCols()) {
      return false;
    }
    if (typeof endRow !== "undefined") {
      if (typeof endRow !== 'number' || endRow < 0 || endRow >= instance.countRows()) {
        return false;
      }
      if (typeof endCol !== 'number' || endCol < 0 || endCol >= instance.countCols()) {
        return false;
      }
    }
    priv.selStart.coords({row: row, col: col});
    instance.listen(); //needed or otherwise prepare won't focus the cell. selectionSpec tests this (should move focus to selected cell)
    if (typeof endRow === "undefined") {
      selection.setRangeEnd({row: row, col: col}, scrollToCell);
    }
    else {
      selection.setRangeEnd({row: endRow, col: endCol}, scrollToCell);
    }

    instance.selection.finish();
    return true;
  };

  this.selectCellByProp = function (row, prop, endRow, endProp, scrollToCell) {
    arguments[1] = datamap.propToCol(arguments[1]);
    if (typeof arguments[3] !== "undefined") {
      arguments[3] = datamap.propToCol(arguments[3]);
    }
    return instance.selectCell.apply(instance, arguments);
  };

  /**
   * Deselects current sell selection on grid
   * @public
   */
  this.deselectCell = function () {
    selection.deselect();
  };

  /**
   * Remove grid from DOM
   * @public
   */
  this.destroy = function () {
    instance.clearTimeouts();
    if (instance.view) { //in case HT is destroyed before initialization has finished
      instance.view.wt.destroy();
    }
    instance.rootElement.empty();
    instance.rootElement.removeData('handsontable');
    instance.rootElement.off('.handsontable');
    $(window).off('.' + instance.guid);
    $document.off('.' + instance.guid);
    $body.off('.' + instance.guid);
    instance.copyPaste.removeCallback(priv.onCut);
    instance.copyPaste.removeCallback(priv.onPaste);
    instance.PluginHooks.run('afterDestroy');
  };

  /**
   * Return Handsontable instance
   * @public
   * @return {Object}
   */
  this.getInstance = function () {
    return instance.rootElement.data("handsontable");
  };

  (function () {
    // Create new instance of plugin hooks
    instance.PluginHooks = new Handsontable.PluginHookClass();

    // Upgrade methods to call of global PluginHooks instance
    var _run = instance.PluginHooks.run
      , _exe = instance.PluginHooks.execute;

    instance.PluginHooks.run = function (key, p1, p2, p3, p4, p5) {
      _run.call(this, instance, key, p1, p2, p3, p4, p5);
      Handsontable.PluginHooks.run(instance, key, p1, p2, p3, p4, p5);
    };

    instance.PluginHooks.execute = function (key, p1, p2, p3, p4, p5) {
      p1 = _exe.call(this, instance, key, p1, p2, p3, p4, p5);
      p1 = Handsontable.PluginHooks.execute(instance, key, p1, p2, p3, p4, p5);

      return p1;
    };

    // Map old API with new methods
    instance.addHook = instance.PluginHooks.add;
    instance.addHookOnce = instance.PluginHooks.once;

    instance.removeHook = instance.PluginHooks.remove;

    instance.runHooks = instance.PluginHooks.run;
    instance.runHooksAndReturn = instance.PluginHooks.execute;

  })();

  this.timeouts = {};

  /**
   * Sets timeout. Purpose of this method is to clear all known timeouts when `destroy` method is called
   * @public
   */
  this.registerTimeout = function (key, handle, ms) {
    clearTimeout(this.timeouts[key]);
    this.timeouts[key] = setTimeout(handle, ms || 0);
  };

  /**
   * Clears all known timeouts
   * @public
   */
  this.clearTimeouts = function () {
    for (var key in this.timeouts) {
      if (this.timeouts.hasOwnProperty(key)) {
        clearTimeout(this.timeouts[key]);
      }
    }
  };

  /**
   * Handsontable version
   */
  this.version = '0.9.9'; //inserted by grunt from package.json
};

var DefaultSettings = function () {
};
DefaultSettings.prototype = {
  data: void 0,
  width: void 0,
  height: void 0,
  startRows: 5,
  startCols: 5,
  minRows: 0,
  minCols: 0,
  maxRows: Infinity,
  maxCols: Infinity,
  minSpareRows: 0,
  minSpareCols: 0,
  multiSelect: true,
  fillHandle: true,
  fixedRowsTop: 0,
  fixedColumnsLeft: 0,
  undo: true,
  outsideClickDeselects: true,
  enterBeginsEditing: true,
  enterMoves: {row: 1, col: 0},
  tabMoves: {row: 0, col: 1},
  autoWrapRow: false,
  autoWrapCol: false,
  copyRowsLimit: 1000,
  copyColsLimit: 1000,
  pasteMode: 'overwrite',
  currentRowClassName: void 0,
  currentColClassName: void 0,
  stretchH: 'hybrid',
  isEmptyRow: void 0,
  isEmptyCol: void 0,
  observeDOMVisibility: true,
  allowInvalid: true,
  invalidCellClassName: 'htInvalid',
  fragmentSelection: false,
  readOnly: false
};

$.fn.handsontable = function (action) {
  var i
    , ilen
    , args
    , output
    , userSettings
    , $this = this.first() // Use only first element from list
    , instance = $this.data('handsontable');

  // Init case
  if (typeof action !== 'string') {
    userSettings = action || {};
    if (instance) {
      instance.updateSettings(userSettings);
    }
    else {
      instance = new Handsontable.Core($this, userSettings);
      $this.data('handsontable', instance);
      instance.init();
    }

    return $this;
  }
  // Action case
  else {
    args = [];
    if (arguments.length > 1) {
      for (i = 1, ilen = arguments.length; i < ilen; i++) {
        args.push(arguments[i]);
      }
    }

    if (instance) {
      if (typeof instance[action] !== 'undefined') {
        output = instance[action].apply(instance, args);
      }
      else {
        throw new Error('Handsontable do not provide action: ' + action);
      }
    }

    return output;
  }
};

/**
 * Handsontable TableView constructor
 * @param {Object} instance
 */
Handsontable.TableView = function (instance) {
  var that = this
    , $window = $(window)
    , $documentElement = $(document.documentElement);

  this.instance = instance;
  this.settings = instance.getSettings();
  this.settingsFromDOM = instance.getSettingsFromDOM();

  instance.rootElement.data('originalStyle', instance.rootElement.attr('style')); //needed to retrieve original style in jsFiddle link generator in HT examples. may be removed in future versions
  instance.rootElement.addClass('handsontable');

  var table = document.createElement('TABLE');
  table.className = 'htCore';
  table.appendChild(document.createElement('THEAD'));
  table.appendChild(document.createElement('TBODY'));

  instance.$table = $(table);
  instance.rootElement.prepend(instance.$table);

  $documentElement.on('keyup.' + instance.guid, function (event) {
    if (instance.selection.isInProgress() && !event.shiftKey) {
      instance.selection.finish();
    }
  });

  var isMouseDown
    , dragInterval;

  $documentElement.on('mouseup.' + instance.guid, function (event) {
    if (instance.selection.isInProgress() && event.which === 1) { //is left mouse button
      instance.selection.finish();
    }

    isMouseDown = false;
    clearInterval(dragInterval);
    dragInterval = null;

    if (instance.autofill.handle && instance.autofill.handle.isDragged) {
      if (instance.autofill.handle.isDragged > 1) {
        instance.autofill.apply();
      }
      instance.autofill.handle.isDragged = 0;
    }
  });

  $documentElement.on('mousedown.' + instance.guid, function (event) {
    var next = event.target;

    if (next !== that.wt.wtTable.spreader) { //immediate click on "spreader" means click on the right side of vertical scrollbar
      while (next !== document.documentElement) {
        //X-HANDSONTABLE is the tag name in Web Components version of HOT. Removal of this breaks cell selection
        if (next === null) {
          return; //click on something that was a row but now is detached (possibly because your click triggered a rerender)
        }
        if (next === instance.rootElement[0] || next.nodeName === 'X-HANDSONTABLE' || next.id === 'context-menu-layer' || $(next).is('.context-menu-list') || $(next).is('.typeahead li')) {
          return; //click inside container
        }
        next = next.parentNode;
      }
    }

    if (that.settings.outsideClickDeselects) {
      instance.deselectCell();
    }
    else {
      instance.destroyEditor();
    }
  });

  instance.$table.on('selectstart', function (event) {
    if (that.settings.fragmentSelection) {
      return;
    }

    //https://github.com/warpech/jquery-handsontable/issues/160
    //selectstart is IE only event. Prevent text from being selected when performing drag down in IE8
    event.preventDefault();
  });

  instance.$table.on('mouseenter', function () {
    if (dragInterval) { //if dragInterval was set (that means mouse was really outside of table, not over an element that is outside of <table> in DOM
      clearInterval(dragInterval);
      dragInterval = null;
    }
  });

  instance.$table.on('mouseleave', function (event) {
    if (!(isMouseDown || (instance.autofill.handle && instance.autofill.handle.isDragged))) {
      return;
    }

    var tolerance = 1 //this is needed because width() and height() contains stuff like cell borders
      , offset = that.wt.wtDom.offset(table)
      , offsetTop = offset.top + tolerance
      , offsetLeft = offset.left + tolerance
      , width = that.containerWidth - that.wt.getSetting('scrollbarWidth') - 2 * tolerance
      , height = that.containerHeight - that.wt.getSetting('scrollbarHeight') - 2 * tolerance
      , method
      , row = 0
      , col = 0
      , dragFn;

    if (event.pageY < offsetTop) { //top edge crossed
      row = -1;
      method = 'scrollVertical';
    }
    else if (event.pageY >= offsetTop + height) { //bottom edge crossed
      row = 1;
      method = 'scrollVertical';
    }
    else if (event.pageX < offsetLeft) { //left edge crossed
      col = -1;
      method = 'scrollHorizontal';
    }
    else if (event.pageX >= offsetLeft + width) { //right edge crossed
      col = 1;
      method = 'scrollHorizontal';
    }

    if (method) {
      dragFn = function () {
        if (isMouseDown || (instance.autofill.handle && instance.autofill.handle.isDragged)) {
          //instance.selection.transformEnd(row, col);
          that.wt[method](row + col).draw();
        }
      };
      dragFn();
      dragInterval = setInterval(dragFn, 100);
    }
  });

  var clearTextSelection = function () {
    //http://stackoverflow.com/questions/3169786/clear-text-selection-with-javascript
    if (window.getSelection) {
      if (window.getSelection().empty) {  // Chrome
        window.getSelection().empty();
      } else if (window.getSelection().removeAllRanges) {  // Firefox
        window.getSelection().removeAllRanges();
      }
    } else if (document.selection) {  // IE?
      document.selection.empty();
    }
  };

  var walkontableConfig = {
    table: table,
    stretchH: this.settings.stretchH,
    data: instance.getDataAtCell,
    totalRows: instance.countRows,
    totalColumns: instance.countCols,
    scrollbarModelV: this.settings.scrollbarModelV,
    scrollbarModelH: this.settings.scrollbarModelH,
    offsetRow: 0,
    offsetColumn: 0,
    width: this.getWidth(),
    height: this.getHeight(),
    fixedColumnsLeft: function () {
      return that.settings.fixedColumnsLeft;
    },
    fixedRowsTop: function () {
      return that.settings.fixedRowsTop;
    },
    rowHeaders: function () {
      return that.settings.rowHeaders ? [function (index, TH) {
        that.appendRowHeader(index, TH);
      }] : []
    },
    columnHeaders: function () {
      return that.settings.colHeaders ? [function (index, TH) {
        that.appendColHeader(index, TH);
      }] : []
    },
    columnWidth: instance.getColWidth,
    cellRenderer: function (row, column, TD) {
      that.applyCellTypeMethod('renderer', TD, row, column);
    },
    selections: {
      current: {
        className: 'current',
        border: {
          width: 2,
          color: '#5292F7',
          style: 'solid',
          cornerVisible: function () {
            return that.settings.fillHandle && !that.isCellEdited() && !instance.selection.isMultiple()
          }
        }
      },
      area: {
        className: 'area',
        border: {
          width: 1,
          color: '#89AFF9',
          style: 'solid',
          cornerVisible: function () {
            return that.settings.fillHandle && !that.isCellEdited() && instance.selection.isMultiple()
          }
        }
      },
      highlight: {
        highlightRowClassName: that.settings.currentRowClassName,
        highlightColumnClassName: that.settings.currentColClassName
      },
      fill: {
        className: 'fill',
        border: {
          width: 1,
          color: 'red',
          style: 'solid'
        }
      }
    },
    hideBorderOnMouseDownOver: function () {
      return that.settings.fragmentSelection;
    },
    onCellMouseDown: function (event, coords, TD) {
      Handsontable.activeGuid = instance.guid;

      isMouseDown = true;
      var coordsObj = {row: coords[0], col: coords[1]};
      if (event.button === 2 && instance.selection.inInSelection(coordsObj)) { //right mouse button
        //do nothing
      }
      else if (event.shiftKey) {
        instance.selection.setRangeEnd(coordsObj);
      }
      else {
        instance.selection.setRangeStart(coordsObj);
      }

      if (!that.settings.fragmentSelection) {
        event.preventDefault(); //disable text selection in Chrome
        clearTextSelection();
      }

      if (that.settings.afterOnCellMouseDown) {
        that.settings.afterOnCellMouseDown.call(instance, event, coords, TD);
      }
    },
    /*onCellMouseOut: function (/*event, coords, TD* /) {
     if (isMouseDown && that.settings.fragmentSelection === 'single') {
     clearTextSelection(); //otherwise text selection blinks during multiple cells selection
     }
     },*/
    onCellMouseOver: function (event, coords/*, TD*/) {
      var coordsObj = {row: coords[0], col: coords[1]};
      if (isMouseDown) {
        /*if (that.settings.fragmentSelection === 'single') {
         clearTextSelection(); //otherwise text selection blinks during multiple cells selection
         }*/
        instance.selection.setRangeEnd(coordsObj);
      }
      else if (instance.autofill.handle && instance.autofill.handle.isDragged) {
        instance.autofill.handle.isDragged++;
        instance.autofill.showBorder(coords);
      }
    },
    onCellCornerMouseDown: function (event) {
      instance.autofill.handle.isDragged = 1;
      event.preventDefault();
    },
    onCellCornerDblClick: function () {
      instance.autofill.selectAdjacent();
    },
    beforeDraw: function (force) {
      that.beforeRender(force);
    }
  };

  instance.PluginHooks.run('beforeInitWalkontable', walkontableConfig);

  this.wt = new Walkontable(walkontableConfig);

  $window.on('resize.' + instance.guid, function () {
    instance.registerTimeout('resizeTimeout', function () {
      instance.parseSettingsFromDOM();
      var newWidth = that.getWidth();
      var newHeight = that.getHeight();
      if (walkontableConfig.width !== newWidth || walkontableConfig.height !== newHeight) {
        instance.forceFullRender = true;
        that.render();
        walkontableConfig.width = newWidth;
        walkontableConfig.height = newHeight;
      }
    }, 60);
  });

  $(that.wt.wtTable.spreader).on('mousedown.handsontable, contextmenu.handsontable', function (event) {
    if (event.target === that.wt.wtTable.spreader && event.which === 3) { //right mouse button exactly on spreader means right clickon the right hand side of vertical scrollbar
      event.stopPropagation();
    }
  });

  $documentElement.on('click.' + instance.guid, function () {
    if (that.settings.observeDOMVisibility) {
      if (that.wt.drawInterrupted) {
        that.instance.forceFullRender = true;
        that.render();
      }
    }
  });
};

Handsontable.TableView.prototype.isCellEdited = function () {
  return (this.instance.textEditor && this.instance.textEditor.isCellEdited) || (this.instance.autocompleteEditor && this.instance.autocompleteEditor.isCellEdited) || (this.instance.handsontableEditor && this.instance.handsontableEditor.isCellEdited);
};

Handsontable.TableView.prototype.getWidth = function () {
  var val = this.settings.width !== void 0 ? this.settings.width : this.settingsFromDOM.width;
  return typeof val === 'function' ? val() : val;
};

Handsontable.TableView.prototype.getHeight = function () {
  var val = this.settings.height !== void 0 ? this.settings.height : this.settingsFromDOM.height;
  return typeof val === 'function' ? val() : val;
};

Handsontable.TableView.prototype.beforeRender = function (force) {
  if (force) {
    this.instance.PluginHooks.run('beforeRender');
    this.wt.update('width', this.getWidth());
    this.wt.update('height', this.getHeight());
  }
};

Handsontable.TableView.prototype.render = function () {
  this.wt.draw(!this.instance.forceFullRender);
  this.instance.rootElement.triggerHandler('render.handsontable');
  if (this.instance.forceFullRender) {
    this.instance.PluginHooks.run('afterRender');
  }
  this.instance.forceFullRender = false;
};

Handsontable.TableView.prototype.applyCellTypeMethod = function (methodName, td, row, col) {
  var prop = this.instance.colToProp(col)
    , cellProperties = this.instance.getCellMeta(row, col)
    , method = Handsontable.helper.getCellMethod(methodName, cellProperties[methodName]); //methodName is 'renderer' or 'editor'

  return method(this.instance, td, row, col, prop, this.instance.getDataAtRowProp(row, prop), cellProperties);
};

/**
 * Returns td object given coordinates
 */
Handsontable.TableView.prototype.getCellAtCoords = function (coords) {
  var td = this.wt.wtTable.getCell([coords.row, coords.col]);
  if (td < 0) { //there was an exit code (cell is out of bounds)
    return null;
  }
  else {
    return td;
  }
};

/**
 * Scroll viewport to selection
 * @param coords
 */
Handsontable.TableView.prototype.scrollViewport = function (coords) {
  this.wt.scrollViewport([coords.row, coords.col]);
};

/**
 * Append row header to a TH element
 * @param row
 * @param TH
 */
Handsontable.TableView.prototype.appendRowHeader = function (row, TH) {
  if (row > -1) {
    this.wt.wtDom.fastInnerHTML(TH, this.instance.getRowHeader(row));
  }
  else {
    this.wt.wtDom.empty(TH);
  }
};

/**
 * Append column header to a TH element
 * @param col
 * @param TH
 */
Handsontable.TableView.prototype.appendColHeader = function (col, TH) {
  var DIV = document.createElement('DIV')
    , SPAN = document.createElement('SPAN');

  DIV.className = 'relative';
  SPAN.className = 'colHeader';

  this.wt.wtDom.fastInnerHTML(SPAN, this.instance.getColHeader(col));
  DIV.appendChild(SPAN);

  while (TH.firstChild) {
    TH.removeChild(TH.firstChild); //empty TH node
  }
  TH.appendChild(DIV);
  this.instance.PluginHooks.run('afterGetColHeader', col, TH);
};

/**
 * Returns true if keyCode represents a printable character
 * @param {Number} keyCode
 * @return {Boolean}
 */
Handsontable.helper.isPrintableChar = function (keyCode) {
  return ((keyCode == 32) || //space
    (keyCode >= 48 && keyCode <= 57) || //0-9
    (keyCode >= 96 && keyCode <= 111) || //numpad
    (keyCode >= 186 && keyCode <= 192) || //;=,-./`
    (keyCode >= 219 && keyCode <= 222) || //[]{}\|"'
    keyCode >= 226 || //special chars (229 for Asian chars)
    (keyCode >= 65 && keyCode <= 90)); //a-z
};

/**
 * Converts a value to string
 * @param value
 * @return {String}
 */
Handsontable.helper.stringify = function (value) {
  switch (typeof value) {
    case 'string':
    case 'number':
      return value + '';
      break;

    case 'object':
      if (value === null) {
        return '';
      }
      else {
        return value.toString();
      }
      break;

    case 'undefined':
      return '';
      break;

    default:
      return value.toString();
  }
};

/**
 * Generates spreadsheet-like column names: A, B, C, ..., Z, AA, AB, etc
 * @param index
 * @returns {String}
 */
Handsontable.helper.spreadsheetColumnLabel = function (index) {
  var dividend = index + 1;
  var columnLabel = '';
  var modulo;
  while (dividend > 0) {
    modulo = (dividend - 1) % 26;
    columnLabel = String.fromCharCode(65 + modulo) + columnLabel;
    dividend = parseInt((dividend - modulo) / 26, 10);
  }
  return columnLabel;
};

/**
 * Checks if value of n is a numeric one
 * http://jsperf.com/isnan-vs-isnumeric/4
 * @param n
 * @returns {boolean}
 */
Handsontable.helper.isNumeric = function (n) {
    var t = typeof n;
    return t == 'number' ? !isNaN(n) && isFinite(n) :
           t == 'string' ? !n.length ? false :
           n.length == 1 ? /\d/.test(n) :
           /^\s*[+-]?\s*(?:(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?)|(?:0x[a-f\d]+))\s*$/i.test(n) :
           t == 'object' ? !!n && typeof n.valueOf() == "number" && !(n instanceof Date) : false;
};

/**
 * Checks if child is a descendant of given parent node
 * http://stackoverflow.com/questions/2234979/how-to-check-in-javascript-if-one-element-is-a-child-of-another
 * @param parent
 * @param child
 * @returns {boolean}
 */
Handsontable.helper.isDescendant = function (parent, child) {
  var node = child.parentNode;
  while (node != null) {
    if (node == parent) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

/**
 * Generates a random hex string. Used as namespace for Handsontable instance events.
 * @return {String} - 16 character random string: "92b1bfc74ec4"
 */
Handsontable.helper.randomString = function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return s4() + s4() + s4() + s4();
};

/**
 * Inherit without without calling parent constructor, and setting `Child.prototype.constructor` to `Child` instead of `Parent`.
 * Creates temporary dummy function to call it as constructor.
 * Described in ticket: https://github.com/warpech/jquery-handsontable/pull/516
 * @param  {Object} Child  child class
 * @param  {Object} Parent parent class
 * @return {Object}        extended Child
 */
Handsontable.helper.inherit = function (Child, Parent) {
  function Bridge() {
  }

  Bridge.prototype = Parent.prototype;
  Child.prototype = new Bridge();
  Child.prototype.constructor = Child;
  return Child;
};

/**
 * Perform shallow extend of a target object with extension's own properties
 * @param {Object} target An object that will receive the new properties
 * @param {Object} extension An object containing additional properties to merge into the target
 */
Handsontable.helper.extend = function (target, extension) {
  for (var i in extension) {
    if (extension.hasOwnProperty(i)) {
      target[i] = extension[i];
    }
  }
};

/**
 * Factory for columns constructors.
 * @param {Object} GridSettings
 * @param {Array} conflictList
 * @param {Object} defaultCell
 * @return {Object} ColumnSettings
 */
Handsontable.helper.columnFactory = function (GridSettings, conflictList, defaultCell) {
  var i = 0, len = conflictList.length, ColumnSettings = function () {
  };

  // Inherit prototype from grid settings
  ColumnSettings.prototype = new GridSettings();

  // Clear conflict settings
  for (; i < len; i++) {
    ColumnSettings.prototype[conflictList[i]] = void 0;
  }

  // Inherit settings from default (text) cell
  for (i in defaultCell) {
    if (defaultCell.hasOwnProperty(i)) {
      ColumnSettings.prototype[i] = defaultCell[i];
    }
  }

  return ColumnSettings;
};

Handsontable.helper.translateRowsToColumns = function (input) {
  var i
    , ilen
    , j
    , jlen
    , output = []
    , olen = 0;

  for (i = 0, ilen = input.length; i < ilen; i++) {
    for (j = 0, jlen = input[i].length; j < jlen; j++) {
      if (j == olen) {
        output.push([]);
        olen++;
      }
      output[j].push(input[i][j])
    }
  }
  return output;
};

Handsontable.helper.to2dArray = function (arr) {
  var i = 0
    , ilen = arr.length;
  while (i < ilen) {
    arr[i] = [arr[i]];
    i++;
  }
};

Handsontable.helper.extendArray = function (arr, extension) {
  var i = 0
    , ilen = extension.length;
  while (i < ilen) {
    arr.push(extension[i]);
    i++;
  }
};

/**
 * Returns cell renderer or editor function directly or through lookup map
 */
Handsontable.helper.getCellMethod = function (methodName, methodFunction) {
  if (typeof methodFunction === 'string') {
    var result = Handsontable.cellLookup[methodName][methodFunction];
    if (result === void 0) {
      throw new Error('You declared cell ' + methodName + ' "' + methodFunction + '" as a string that is not mapped to a known function. Cell ' + methodName + ' must be a function or a string mapped to a function in Handsontable.cellLookup.' + methodName + ' lookup object');
    }
    return result;
  }
  else {
    return methodFunction;
  }
};
/**
 * Handsontable UndoRedo class
 */
Handsontable.UndoRedo = function (instance) {
  var that = this;
  this.instance = instance;
  this.clear();
  Handsontable.PluginHooks.add("afterChange", function (changes, origin) {
    if (origin !== 'undo' && origin !== 'redo') {
      that.add(changes, origin);
    }
  });
};

/**
 * Undo operation from current revision
 */
Handsontable.UndoRedo.prototype.undo = function () {
  var i, ilen;
  if (this.isUndoAvailable()) {
    var setData = $.extend(true, [], this.data[this.rev]);
    for (i = 0, ilen = setData.length; i < ilen; i++) {
      setData[i].splice(3, 1);
    }
    this.instance.setDataAtRowProp(setData, null, null, 'undo');
    this.rev--;
  }
};

/**
 * Redo operation from current revision
 */
Handsontable.UndoRedo.prototype.redo = function () {
  var i, ilen;
  if (this.isRedoAvailable()) {
    this.rev++;
    var setData = $.extend(true, [], this.data[this.rev]);
    for (i = 0, ilen = setData.length; i < ilen; i++) {
      setData[i].splice(2, 1);
    }
    this.instance.setDataAtRowProp(setData, null, null, 'redo');
  }
};

/**
 * Returns true if undo point is available
 * @return {Boolean}
 */
Handsontable.UndoRedo.prototype.isUndoAvailable = function () {
  return (this.rev >= 0);
};

/**
 * Returns true if redo point is available
 * @return {Boolean}
 */
Handsontable.UndoRedo.prototype.isRedoAvailable = function () {
  return (this.rev < this.data.length - 1);
};

/**
 * Add new history poins
 * @param changes
 */
Handsontable.UndoRedo.prototype.add = function (changes, source) {
  this.rev++;
  this.data.splice(this.rev); //if we are in point abcdef(g)hijk in history, remove everything after (g)
  this.data.push(changes);
};

/**
 * Clears undo history
 */
Handsontable.UndoRedo.prototype.clear = function () {
  this.data = [];
  this.rev = -1;
};
Handsontable.SelectionPoint = function () {
  this._row = null; //private use intended
  this._col = null;
};

Handsontable.SelectionPoint.prototype.exists = function () {
  return (this._row !== null);
};

Handsontable.SelectionPoint.prototype.row = function (val) {
  if (val !== void 0) {
    this._row = val;
  }
  return this._row;
};

Handsontable.SelectionPoint.prototype.col = function (val) {
  if (val !== void 0) {
    this._col = val;
  }
  return this._col;
};

Handsontable.SelectionPoint.prototype.coords = function (coords) {
  if (coords !== void 0) {
    this._row = coords.row;
    this._col = coords.col;
  }
  return {
    row: this._row,
    col: this._col
  }
};

Handsontable.SelectionPoint.prototype.arr = function (arr) {
  if (arr !== void 0) {
    this._row = arr[0];
    this._col = arr[1];
  }
  return [this._row, this._col]
};
/**
 * Default text renderer
 * @param {Object} instance Handsontable instance
 * @param {Element} TD Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Value to render (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.TextRenderer = function (instance, TD, row, col, prop, value, cellProperties) {
  var escaped = Handsontable.helper.stringify(value);
  instance.view.wt.wtDom.fastInnerText(TD, escaped); //this is faster than innerHTML. See: https://github.com/warpech/jquery-handsontable/wiki/JavaScript-&-DOM-performance-tips
  if (cellProperties.readOnly) {
    instance.view.wt.wtDom.addClass(TD, 'htDimmed');
  }
  if (cellProperties.valid === false && cellProperties.invalidCellClassName) {
    TD.className = cellProperties.invalidCellClassName;
  }
};
var clonableTEXT = document.createElement('DIV');
clonableTEXT.className = 'htAutocomplete';

var clonableARROW = document.createElement('DIV');
clonableARROW.className = 'htAutocompleteArrow';
clonableARROW.appendChild(document.createTextNode('\u25BC'));
//this is faster than innerHTML. See: https://github.com/warpech/jquery-handsontable/wiki/JavaScript-&-DOM-performance-tips

/**
 * Autocomplete renderer
 * @param {Object} instance Handsontable instance
 * @param {Element} TD Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Value to render (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.AutocompleteRenderer = function (instance, TD, row, col, prop, value, cellProperties) {
  var TEXT = clonableTEXT.cloneNode(false); //this is faster than createElement
  var ARROW = clonableARROW.cloneNode(true); //this is faster than createElement

  if (!instance.acArrowListener) {
    //not very elegant but easy and fast
    instance.acArrowListener = function () {
      instance.view.wt.getSetting('onCellDblClick');
    };
    instance.rootElement.on('mouseup', '.htAutocompleteArrow', instance.acArrowListener); //this way we don't bind event listener to each arrow. We rely on propagation instead
  }

  Handsontable.TextRenderer(instance, TEXT, row, col, prop, value, cellProperties);

  if (!TEXT.firstChild) { //http://jsperf.com/empty-node-if-needed
    //otherwise empty fields appear borderless in demo/renderers.html (IE)
    TEXT.appendChild(document.createTextNode('\u00A0')); //\u00A0 equals &nbsp; for a text node
    //this is faster than innerHTML. See: https://github.com/warpech/jquery-handsontable/wiki/JavaScript-&-DOM-performance-tips
  }

  TEXT.appendChild(ARROW);
  instance.view.wt.wtDom.empty(TD); //TODO identify under what circumstances this line can be removed
  TD.appendChild(TEXT);
};
var clonableINPUT = document.createElement('INPUT');
clonableINPUT.className = 'htCheckboxRendererInput';
clonableINPUT.type = 'checkbox';
clonableINPUT.setAttribute('autocomplete', 'off');

/**
 * Checkbox renderer
 * @param {Object} instance Handsontable instance
 * @param {Element} TD Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Value to render (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.CheckboxRenderer = function (instance, TD, row, col, prop, value, cellProperties) {
  if (typeof cellProperties.checkedTemplate === "undefined") {
    cellProperties.checkedTemplate = true;
  }
  if (typeof cellProperties.uncheckedTemplate === "undefined") {
    cellProperties.uncheckedTemplate = false;
  }

  instance.view.wt.wtDom.empty(TD); //TODO identify under what circumstances this line can be removed

  var INPUT = clonableINPUT.cloneNode(false); //this is faster than createElement

  if (value === cellProperties.checkedTemplate || value === Handsontable.helper.stringify(cellProperties.checkedTemplate)) {
    INPUT.checked = true;
    TD.appendChild(INPUT);
  }
  else if (value === cellProperties.uncheckedTemplate || value === Handsontable.helper.stringify(cellProperties.uncheckedTemplate)) {
    TD.appendChild(INPUT);
  }
  else if (value === null) { //default value
    INPUT.className += ' noValue';
    TD.appendChild(INPUT);
  }
  else {
    instance.view.wt.wtDom.fastInnerText(TD, '#bad value#'); //this is faster than innerHTML. See: https://github.com/warpech/jquery-handsontable/wiki/JavaScript-&-DOM-performance-tips
  }

  var $input = $(INPUT);

  if (cellProperties.readOnly) {
    $input.on('click', function (event) {
      event.preventDefault();
    });
  }
  else {
    $input.on('mousedown', function (event) {
      if (!this.checked) {
        instance.setDataAtRowProp(row, prop, cellProperties.checkedTemplate);
      }
      else {
        instance.setDataAtRowProp(row, prop, cellProperties.uncheckedTemplate);
      }

      event.stopPropagation(); //otherwise can confuse cell mousedown handler
    });

    $input.on('mouseup', function (event) {
      event.stopPropagation(); //otherwise can confuse cell dblclick handler
    });
  }

  return TD;
};
/**
 * Numeric cell renderer
 * @param {Object} instance Handsontable instance
 * @param {Element} TD Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Value to render (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.NumericRenderer = function (instance, TD, row, col, prop, value, cellProperties) {
  if (Handsontable.helper.isNumeric(value)) {
    if (typeof cellProperties.language !== 'undefined') {
      numeral.language(cellProperties.language)
    }
    value = numeral(value).format(cellProperties.format || '0'); //docs: http://numeraljs.com/
    instance.view.wt.wtDom.addClass(TD, 'htNumeric');
  }
  Handsontable.TextRenderer(instance, TD, row, col, prop, value, cellProperties);
};
function HandsontableTextEditorClass(instance) {
  this.isCellEdited = false;
  this.instance = instance;
  this.createElements();
  this.bindEvents();
}

HandsontableTextEditorClass.prototype.createElements = function () {
  this.wtDom = new WalkontableDom();

  this.TEXTAREA = document.createElement('TEXTAREA');
  this.TEXTAREA.className = 'handsontableInput';
  this.textareaStyle = this.TEXTAREA.style;
  this.textareaStyle.width = 0;
  this.textareaStyle.height = 0;
  this.$textarea = $(this.TEXTAREA);

  this.TEXTAREA_PARENT = document.createElement('DIV');
  this.TEXTAREA_PARENT.className = 'handsontableInputHolder';
  this.textareaParentStyle = this.TEXTAREA_PARENT.style;
  this.textareaParentStyle.top = 0;
  this.textareaParentStyle.left = 0;
  this.textareaParentStyle.display = 'none';
  this.$textareaParent = $(this.TEXTAREA_PARENT);

  this.$body = $(document.body);

  this.TEXTAREA_PARENT.appendChild(this.TEXTAREA);
  this.instance.rootElement[0].appendChild(this.TEXTAREA_PARENT);

  var that = this;
  Handsontable.PluginHooks.add('afterRender', function () {
    that.instance.registerTimeout('refresh_editor_dimensions', function () {
      that.refreshDimensions();
    }, 0);
  });
};

HandsontableTextEditorClass.prototype.bindEvents = function () {
  var that = this;
  this.$textareaParent.off('.editor').on('keydown.editor', function (event) {
    //if we are here then isCellEdited === true

    that.instance.PluginHooks.run('beforeKeyDown', event);
    if(event.isImmediatePropagationStopped()) { //event was cancelled in beforeKeyDown
      return;
    }

    var ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey; //catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)

    if (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93) {
      //when CTRL or its equivalent is pressed and cell is edited, don't prepare selectable text in textarea
      event.stopImmediatePropagation();
      return;
    }

    switch (event.keyCode) {
      case 38: /* arrow up */
      case 40: /* arrow down */
        that.finishEditing(false);
        break;

      case 9: /* tab */
        that.finishEditing(false);
        event.preventDefault();
        break;

      case 39: /* arrow right */
        if (that.getCaretPosition(that.TEXTAREA) === that.TEXTAREA.value.length) {
          that.finishEditing(false);
        }
        else {
          event.stopImmediatePropagation();
        }
        break;

      case 37: /* arrow left */
        if (that.getCaretPosition(that.TEXTAREA) === 0) {
          that.finishEditing(false);
        }
        else {
          event.stopImmediatePropagation();
        }
        break;

      case 27: /* ESC */
        that.instance.destroyEditor(true);
        event.stopImmediatePropagation();
        break;

      case 13: /* return/enter */
        var selected = that.instance.getSelected();
        var isMultipleSelection = !(selected[0] === selected[2] && selected[1] === selected[3]);
        if ((event.ctrlKey && !isMultipleSelection) || event.altKey) { //if ctrl+enter or alt+enter, add new line
          that.TEXTAREA.value = that.TEXTAREA.value + '\n';
          that.TEXTAREA.focus();
          event.stopImmediatePropagation();
        }
        else {
          that.finishEditing(false, ctrlDown);
        }
        event.preventDefault(); //don't add newline to field
        break;

      default:
        event.stopImmediatePropagation(); //backspace, delete, home, end, CTRL+A, CTRL+C, CTRL+V, CTRL+X should only work locally when cell is edited (not in table context)
        break;
    }
  });
};

HandsontableTextEditorClass.prototype.bindTemporaryEvents = function (td, row, col, prop, value, cellProperties) {
  this.TD = td;
  this.row = row;
  this.col = col;
  this.prop = prop;
  this.originalValue = value;
  this.cellProperties = cellProperties;

  var that = this;

  this.$body.on('keydown.editor.' + this.instance.guid, function (event) {
    var ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey; //catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    if (!that.isCellEdited) {
      if (Handsontable.helper.isPrintableChar(event.keyCode)) {
        if (!ctrlDown) { //disregard CTRL-key shortcuts
          that.beginEditing(row, col, prop);
        }
      }
      else if (event.keyCode === 113) { //f2
        that.beginEditing(row, col, prop, true); //show edit field
        event.stopImmediatePropagation();
        event.preventDefault(); //prevent Opera from opening Go to Page dialog
      }
      else if (event.keyCode === 13 && that.instance.getSettings().enterBeginsEditing) { //enter
        var selected = that.instance.getSelected();
        var isMultipleSelection = !(selected[0] === selected[2] && selected[1] === selected[3]);
        if ((ctrlDown && !isMultipleSelection) || event.altKey) { //if ctrl+enter or alt+enter, add new line
          that.beginEditing(row, col, prop, true, '\n'); //show edit field
        }
        else {
          that.beginEditing(row, col, prop, true); //show edit field
        }
        event.preventDefault(); //prevent new line at the end of textarea
        event.stopImmediatePropagation();
      }
    }
  });

  function onDblClick() {
    that.beginEditing(row, col, prop, true);
  }

  this.instance.view.wt.update('onCellDblClick', onDblClick);
};

HandsontableTextEditorClass.prototype.unbindTemporaryEvents = function () {
  this.$body.off(".editor");
  this.instance.view.wt.update('onCellDblClick', null);
};

/**
 * Returns caret position in edit proxy
 * @author http://stackoverflow.com/questions/263743/how-to-get-caret-position-in-textarea
 * @return {Number}
 */
HandsontableTextEditorClass.prototype.getCaretPosition = function (el) {
  if (el.selectionStart) {
    return el.selectionStart;
  }
  else if (document.selection) {
    el.focus();
    var r = document.selection.createRange();
    if (r == null) {
      return 0;
    }
    var re = el.createTextRange(),
      rc = re.duplicate();
    re.moveToBookmark(r.getBookmark());
    rc.setEndPoint('EndToStart', re);
    return rc.text.length;
  }
  return 0;
};

/**
 * Sets caret position in edit proxy
 * @author http://blog.vishalon.net/index.php/javascript-getting-and-setting-caret-position-in-textarea/
 * @param {Number}
 */
HandsontableTextEditorClass.prototype.setCaretPosition = function (el, pos) {
  if (el.setSelectionRange) {
    el.focus();
    el.setSelectionRange(pos, pos);
  }
  else if (el.createTextRange) {
    var range = el.createTextRange();
    range.collapse(true);
    range.moveEnd('character', pos);
    range.moveStart('character', pos);
    range.select();
  }
};

HandsontableTextEditorClass.prototype.beginEditing = function (row, col, prop, useOriginalValue, suffix) {
  if (this.isCellEdited) {
    return;
  }
  this.isCellEdited = true;
  this.row = row;
  this.col = col;
  this.prop = prop;

  var coords = {row: row, col: col};
  this.instance.view.scrollViewport(coords);
  this.instance.view.render();

  this.$textarea.on('cut.editor', function (event) {
    event.stopPropagation();
  });

  this.$textarea.on('paste.editor', function (event) {
    event.stopPropagation();
  });

  if (useOriginalValue) {
    this.TEXTAREA.value = Handsontable.helper.stringify(this.originalValue) + (suffix || '');
  }
  else {
    this.TEXTAREA.value = '';
  }

  this.refreshDimensions(); //need it instantly, to prevent https://github.com/warpech/jquery-handsontable/issues/348
  this.TEXTAREA.focus();
  this.setCaretPosition(this.TEXTAREA, this.TEXTAREA.value.length);
};

HandsontableTextEditorClass.prototype.refreshDimensions = function () {
  if (!this.isCellEdited) {
    return;
  }

  ///start prepare textarea position
  this.TD = this.instance.getCell(this.row, this.col);
  var $td = $(this.TD); //because old td may have been scrolled out with scrollViewport
  var currentOffset = this.wtDom.offset(this.TD);
  var containerOffset = this.wtDom.offset(this.instance.rootElement[0]);
  var scrollTop = this.instance.rootElement.scrollTop();
  var scrollLeft = this.instance.rootElement.scrollLeft();
  var editTop = currentOffset.top - containerOffset.top + scrollTop - 1;
  var editLeft = currentOffset.left - containerOffset.left + scrollLeft - 1;

  var settings = this.instance.getSettings();
  var rowHeadersCount = settings.rowHeaders === false ? 0 : 1;
  var colHeadersCount = settings.colHeaders === false ? 0 : 1;

  if (editTop < 0) {
    editTop = 0;
  }
  if (editLeft < 0) {
    editLeft = 0;
  }

  if (rowHeadersCount > 0 && parseInt($td.css('border-top-width'), 10) > 0) {
    editTop += 1;
  }
  if (colHeadersCount > 0 && parseInt($td.css('border-left-width'), 10) > 0) {
    editLeft += 1;
  }

  if ($.browser.msie && parseInt($.browser.version, 10) <= 7) {
    editTop -= 1;
  }

  this.textareaParentStyle.top = editTop + 'px';
  this.textareaParentStyle.left = editLeft + 'px';
  ///end prepare textarea position

  var width = $td.width()
    , height = $td.outerHeight() - 4;

  if (parseInt($td.css('border-top-width'), 10) > 0) {
    height -= 1;
  }
  if (parseInt($td.css('border-left-width'), 10) > 0) {
    if (rowHeadersCount > 0) {
      width -= 1;
    }
  }

  this.$textarea.autoResize({
    maxHeight: 200,
    minHeight: height,
    minWidth: width,
    maxWidth: Math.max(168, width),
    animate: false,
    extraSpace: 0
  });

  this.textareaParentStyle.display = 'block';
};

HandsontableTextEditorClass.prototype.finishEditing = function (isCancelled, ctrlDown) {
  if (this.isCellEdited) {
    this.isCellEdited = false;
    if (!isCancelled) {
      var val = [
        [$.trim(this.TEXTAREA.value)]
      ];
      if (ctrlDown) { //if ctrl+enter and multiple cells selected, behave like Excel (finish editing and apply to all cells)
        var sel = this.instance.getSelected();
        this.instance.populateFromArray(sel[0], sel[1], val, sel[2], sel[3], 'edit');
      }
      else {
        this.instance.populateFromArray(this.row, this.col, val, null, null, 'edit');
      }
    }
  }

  this.unbindTemporaryEvents();
  if (document.activeElement === this.TEXTAREA) {
    this.instance.listen(); //don't refocus the table if user focused some cell outside of HT on purpose
  }

  this.textareaParentStyle.display = 'none';
};

/**
 * Default text editor
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Original value (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.TextEditor = function (instance, td, row, col, prop, value, cellProperties) {
  if (!instance.textEditor) {
    instance.textEditor = new HandsontableTextEditorClass(instance);
  }
  instance.textEditor.bindTemporaryEvents(td, row, col, prop, value, cellProperties);
  return function (isCancelled) {
    instance.textEditor.finishEditing(isCancelled);
  }
};
function HandsontableAutocompleteEditorClass(instance) {
  this.isCellEdited = false;
  this.instance = instance;
  this.createElements();
  this.bindEvents();
  this.emptyStringLabel = '\u00A0\u00A0\u00A0'; //3 non-breaking spaces
}

Handsontable.helper.inherit(HandsontableAutocompleteEditorClass, HandsontableTextEditorClass);

/**
 * @see HandsontableTextEditorClass.prototype.createElements
 */
HandsontableAutocompleteEditorClass.prototype.createElements = function () {
  HandsontableTextEditorClass.prototype.createElements.call(this);

  this.$textarea.typeahead();
  this.typeahead = this.$textarea.data('typeahead');
  this.typeahead._render = this.typeahead.render;
  this.typeahead.minLength = 0;

  this.typeahead.lookup = function () {
    var items;
    this.query = this.$element.val();
    items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source;
    return items ? this.process(items) : this;
  };

  this.typeahead.matcher = function () {
    return true;
  };

  var _process = this.typeahead.process;
  var that = this;
  this.typeahead.process = function (items) {
    var cloned = false;
    for (var i = 0, ilen = items.length; i < ilen; i++) {
      if (items[i] === '') {
        //this is needed because because of issue #254
        //empty string ('') is a falsy value and breaks the loop in bootstrap-typeahead.js method `sorter`
        //best solution would be to change line: `while (item = items.shift()) {`
        //                                   to: `while ((item = items.shift()) !== void 0) {`
        if (!cloned) {
          //need to clone items before applying emptyStringLabel
          //(otherwise validateChanges fails for empty string)
          items = $.extend([], items);
          cloned = true;
        }
        items[i] = that.emptyStringLabel;
      }
    }
    return _process.call(this, items);
  };
};

/**
 * @see HandsontableTextEditorClass.prototype.bindEvents
 */
HandsontableAutocompleteEditorClass.prototype.bindEvents = function () {
  var that = this;

  this.$textarea.off('keydown').off('keyup').off('keypress'); //unlisten

  this.$textareaParent.off('.acEditor').on('keydown.acEditor', function (event) {
    switch (event.keyCode) {
      case 38: /* arrow up */
        that.typeahead.prev();
        event.stopImmediatePropagation(); //stops TextEditor and core onKeyDown handler
        break;

      case 40: /* arrow down */
        that.typeahead.next();
        event.stopImmediatePropagation(); //stops TextEditor and core onKeyDown handler
        break;

      case 13: /* enter */
        event.preventDefault();
        break;
    }
  });

  this.$textareaParent.on('keyup.acEditor', function (event) {
    if (Handsontable.helper.isPrintableChar(event.keyCode) || event.keyCode === 113 || event.keyCode === 13 || event.keyCode === 8 || event.keyCode === 46) {
      that.typeahead.lookup();
    }
  });


  HandsontableTextEditorClass.prototype.bindEvents.call(this);
};
/**
 * @see HandsontableTextEditorClass.prototype.bindTemporaryEvents
 */
HandsontableAutocompleteEditorClass.prototype.bindTemporaryEvents = function (td, row, col, prop, value, cellProperties) {
  var that = this
    , i
    , j;

  this.typeahead.select = function () {
    var output = this.hide(); //need to hide it before destroyEditor, because destroyEditor checks if menu is expanded
    that.instance.destroyEditor(true);
    var val = this.$menu.find('.active').attr('data-value');
    if (val === that.emptyStringLabel) {
      val = '';
    }
    if (typeof cellProperties.onSelect === 'function') {
      cellProperties.onSelect(row, col, prop, val, this.$menu.find('.active').index());
    }
    else {
      that.instance.setDataAtRowProp(row, prop, val);
    }
    return output;
  };

  this.typeahead.render = function (items) {
    that.typeahead._render.call(this, items);
    if (!cellProperties.strict) {
      this.$menu.find('li:eq(0)').removeClass('active');
    }
    return this;
  };

  /* overwrite typeahead options and methods (matcher, sorter, highlighter, updater, etc) if provided in cellProperties */
  for (i in cellProperties) {
    // if (cellProperties.hasOwnProperty(i)) {
      if (i === 'options') {
        for (j in cellProperties.options) {
          // if (cellProperties.options.hasOwnProperty(j)) {
            this.typeahead.options[j] = cellProperties.options[j];
          // }
        }
      }
      else {
        this.typeahead[i] = cellProperties[i];
      }
    // }
  }

  HandsontableTextEditorClass.prototype.bindTemporaryEvents.call(this, td, row, col, prop, value, cellProperties);

  function onDblClick() {
    that.beginEditing(row, col, prop, true);
    that.instance.registerTimeout('IE9_align_fix', function () { //otherwise is misaligned in IE9
      that.typeahead.lookup();
    }, 1);
  }

  this.instance.view.wt.update('onCellDblClick', onDblClick);
};
/**
 * @see HandsontableTextEditorClass.prototype.finishEditing
 */
HandsontableAutocompleteEditorClass.prototype.finishEditing = function (isCancelled, ctrlDown) {
  if (!isCancelled) {
    if (this.isMenuExpanded() && this.typeahead.$menu.find('.active').length) {
      this.typeahead.select();
      this.isCellEdited = false; //cell value was updated by this.typeahead.select (issue #405)
    }
    else if (this.cellProperties.strict) {
      this.isCellEdited = false; //cell value was not picked from this.typeahead.select (issue #405)
    }
  }

  HandsontableTextEditorClass.prototype.finishEditing.call(this, isCancelled, ctrlDown);
};

HandsontableAutocompleteEditorClass.prototype.isMenuExpanded = function () {
  if (this.typeahead.$menu.is(":visible")) {
    return this.typeahead;
  }
  else {
    return false;
  }
};

/**
 * Autocomplete editor
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Original value (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.AutocompleteEditor = function (instance, td, row, col, prop, value, cellProperties) {
  if (!instance.autocompleteEditor) {
    instance.autocompleteEditor = new HandsontableAutocompleteEditorClass(instance);
  }
  instance.autocompleteEditor.bindTemporaryEvents(td, row, col, prop, value, cellProperties);
  return function (isCancelled) {
    instance.autocompleteEditor.finishEditing(isCancelled);
  }
};
function toggleCheckboxCell(instance, row, prop, cellProperties) {
  if (Handsontable.helper.stringify(instance.getDataAtRowProp(row, prop)) === Handsontable.helper.stringify(cellProperties.checkedTemplate)) {
    instance.setDataAtRowProp(row, prop, cellProperties.uncheckedTemplate);
  }
  else {
    instance.setDataAtRowProp(row, prop, cellProperties.checkedTemplate);
  }
}

/**
 * Checkbox editor
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Original value (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.CheckboxEditor = function (instance, td, row, col, prop, value, cellProperties) {
  if (typeof cellProperties === "undefined") {
    cellProperties = {};
  }
  if (typeof cellProperties.checkedTemplate === "undefined") {
    cellProperties.checkedTemplate = true;
  }
  if (typeof cellProperties.uncheckedTemplate === "undefined") {
    cellProperties.uncheckedTemplate = false;
  }

  instance.$table.on("keydown.editor", function (event) {
    var ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey; //catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    if (!ctrlDown && Handsontable.helper.isPrintableChar(event.keyCode)) {
      toggleCheckboxCell(instance, row, prop, cellProperties);
      event.stopImmediatePropagation(); //stops core onKeyDown handler
      event.preventDefault(); //some keys have special behavior, eg. space bar scrolls screen down
    }
  });

  instance.view.wt.update('onCellDblClick', function () {
    toggleCheckboxCell(instance, row, prop, cellProperties);
  });

  return function () {
    instance.$table.off(".editor");
    instance.view.wt.update('onCellDblClick', null);
  }
};



function HandsontableDateEditorClass(instance) {
  if (!$.datepicker) {
    throw new Error("jQuery UI Datepicker dependency not found. Did you forget to include jquery-ui.custom.js or its substitute?");
  }

  this.isCellEdited = false;
  this.instance = instance;
  this.createElements();
  this.bindEvents();
}

Handsontable.helper.inherit(HandsontableDateEditorClass, HandsontableTextEditorClass);

/**
 * @see HandsontableTextEditorClass.prototype.createElements
 */
HandsontableDateEditorClass.prototype.createElements = function () {
  HandsontableTextEditorClass.prototype.createElements.call(this);

  this.datePicker = document.createElement('DIV');
  this.datePickerStyle = this.datePicker.style;
  this.datePickerStyle.position = 'absolute';
  this.datePickerStyle.top = 0;
  this.datePickerStyle.left = 0;
  this.datePickerStyle.zIndex = 99;
  this.instance.rootElement[0].appendChild(this.datePicker);
  this.$datePicker = $(this.datePicker);

  var that = this;
  var defaultOptions = {
    dateFormat: "yy-mm-dd",
    showButtonPanel: true,
    changeMonth: true,
    changeYear: true,
    altField: this.$textarea,
    onSelect: function () {
      that.finishEditing(false);
    }
  };
  this.$datePicker.datepicker(defaultOptions);
  this.hideDatepicker();
};

/**
 * @see HandsontableTextEditorClass.prototype.beginEditing
 */
HandsontableDateEditorClass.prototype.beginEditing = function (row, col, prop, useOriginalValue, suffix) {
  HandsontableTextEditorClass.prototype.beginEditing.call(this, row, col, prop, useOriginalValue, suffix);
  this.showDatepicker();
};

/**
 * @see HandsontableTextEditorClass.prototype.finishEditing
 */
HandsontableDateEditorClass.prototype.finishEditing = function (isCancelled, ctrlDown) {
  this.hideDatepicker();
  HandsontableTextEditorClass.prototype.finishEditing.call(this, isCancelled, ctrlDown);
};

HandsontableDateEditorClass.prototype.showDatepicker = function () {
  var $td = $(this.instance.dateEditor.TD);
  var position = $td.position();
  this.datePickerStyle.top = (position.top + $td.height()) + 'px';
  this.datePickerStyle.left = position.left + 'px';

  var dateOptions = {
    defaultDate: this.originalValue || void 0
  };
  $.extend(dateOptions, this.cellProperties);
  this.$datePicker.datepicker("option", dateOptions);
  if (this.originalValue) {
    this.$datePicker.datepicker("setDate", this.originalValue);
  }
  this.datePickerStyle.display = 'block';
};

HandsontableDateEditorClass.prototype.hideDatepicker = function () {
  this.datePickerStyle.display = 'none';
};

/**
 * Date editor (uses jQuery UI Datepicker)
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Original value (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.DateEditor = function (instance, td, row, col, prop, value, cellProperties) {
  if (!instance.dateEditor) {
    instance.dateEditor = new HandsontableDateEditorClass(instance);
  }
  instance.dateEditor.bindTemporaryEvents(td, row, col, prop, value, cellProperties);
  return function (isCancelled) {
    instance.dateEditor.finishEditing(isCancelled);
  }
};
/**
 * This is inception. Using Handsontable as Handsontable editor
 */

function HandsontableHandsontableEditorClass(instance) {
  this.isCellEdited = false;
  this.instance = instance;
  this.createElements();
  this.bindEvents();
}

Handsontable.helper.inherit(HandsontableHandsontableEditorClass, HandsontableTextEditorClass);

HandsontableHandsontableEditorClass.prototype.createElements = function () {
  HandsontableTextEditorClass.prototype.createElements.call(this);

  var DIV = document.createElement('DIV');
  DIV.className = 'handsontableEditor';
  this.TEXTAREA_PARENT.appendChild(DIV);

  this.$htContainer = $(DIV);
};

HandsontableHandsontableEditorClass.prototype.bindTemporaryEvents = function (td, row, col, prop, value, cellProperties) {
  var parent = this;

  var options = {
    colHeaders: true,
    cells: function () {
      return {
        readOnly: true
      }
    },
    fillHandle: false,
    width: 2000,
    //width: 'auto',
    afterOnCellMouseDown: function () {
      var sel = this.getSelected();
      parent.TEXTAREA.value = this.getDataAtCell(sel[0], sel[1]);
      parent.instance.destroyEditor();
    },
    beforeOnKeyDown: function (event) {
      switch (event.keyCode) {
        case 27: //esc
          parent.instance.destroyEditor(true);
          break;

        case 13: //enter
          var sel = this.getSelected();
          parent.TEXTAREA.value = this.getDataAtCell(sel[0], sel[1]);
          parent.instance.destroyEditor();
          break;
      }
    }
  };

  if (cellProperties.handsontable) {
    options = $.extend(options, cellProperties.handsontable);
  }

  this.$htContainer.handsontable(options);

  HandsontableTextEditorClass.prototype.bindTemporaryEvents.call(this, td, row, col, prop, value, cellProperties);
};

HandsontableHandsontableEditorClass.prototype.beginEditing = function (row, col, prop, useOriginalValue, suffix) {
  var onBeginEditing = this.instance.getSettings().onBeginEditing;
  if (onBeginEditing && onBeginEditing() === false) {
    return;
  }

  HandsontableTextEditorClass.prototype.beginEditing.call(this, row, col, prop, useOriginalValue, suffix);

  this.$htContainer.handsontable('render');
  this.$htContainer.handsontable('selectCell', 0, 0);
};

HandsontableHandsontableEditorClass.prototype.finishEditing = function (isCancelled, ctrlDown) {
  if (Handsontable.helper.isDescendant(this.instance.rootElement[0], document.activeElement)) {
    //var that = this;
    setTimeout(function () {
      //that.instance.listen(); //return the focus to the cell must be done after destroyer to work in IE7-9
    }, 0);
    //that.instance.listen(); //return the focus to the cell
  }
  this.$htContainer.handsontable('destroy');
  HandsontableTextEditorClass.prototype.finishEditing.call(this, isCancelled, ctrlDown);
};

HandsontableHandsontableEditorClass.prototype.isMenuExpanded = function () {
  if (this.typeahead.$menu.is(":visible")) {
    return this.typeahead;
  }
  else {
    return false;
  }
};

/**
 * Handsontable editor
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Original value (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.HandsontableEditor = function (instance, td, row, col, prop, value, cellProperties) {
  if (!instance.handsontableEditor) {
    instance.handsontableEditor = new HandsontableHandsontableEditorClass(instance);
  }
  instance.handsontableEditor.bindTemporaryEvents(td, row, col, prop, value, cellProperties);

  instance.registerEditor = instance.handsontableEditor;

  return function (isCancelled) {
    instance.handsontableEditor.finishEditing(isCancelled);
  }
};

/**
 * Numeric cell validator
 * @param {*} value - Value of edited cell
 * @param {*} calback - Callback called with validation result
 */
Handsontable.NumericValidator = function (value, callback) {
  callback(/^-?\d*\.?\d*$/.test(value));
}
/**
 * Function responsible for validation of autocomplete value
 * @param {*} value - Value of edited cell
 * @param {*} calback - Callback called with validation result
 */
var process = function (value, callback) {

  var originalVal  = value;
  var lowercaseVal = typeof originalVal === 'string' ? originalVal.toLowerCase() : null;

  return function (source) {
    var found = false;
    for (var s = 0, slen = source.length; s < slen; s++) {
      if (originalVal === source[s]) {
        found = true; //perfect match
        break;
      }
      else if (lowercaseVal === source[s].toLowerCase()) {
        // changes[i][3] = source[s]; //good match, fix the case << TODO?
        found = true;
        break;
      }
    }

    callback(found);
  }
};

/**
 * Autocomplete cell validator
 * @param {*} value - Value of edited cell
 * @param {*} calback - Callback called with validation result
 */
Handsontable.AutocompleteValidator = function (value, callback) {
  if (this.strict && this.source) {
    $.isFunction(this.source) ? this.source(value, process(value, callback)) : process(value, callback)(this.source);
  } else {
    callback(true);
  }
}

/**
 * Cell type is just a shortcut for setting bunch of cellProperties (used in getCellMeta)
 */

Handsontable.AutocompleteCell = {
  editor: Handsontable.AutocompleteEditor,
  renderer: Handsontable.AutocompleteRenderer,
  validator: Handsontable.AutocompleteValidator
};

Handsontable.CheckboxCell = {
  editor: Handsontable.CheckboxEditor,
  renderer: Handsontable.CheckboxRenderer
};

Handsontable.TextCell = {
  editor: Handsontable.TextEditor,
  renderer: Handsontable.TextRenderer
};

Handsontable.NumericCell = {
  editor: Handsontable.TextEditor,
  renderer: Handsontable.NumericRenderer,
  validator: Handsontable.NumericValidator,
  dataType: 'number'
};

Handsontable.DateCell = {
  editor: Handsontable.DateEditor,
  renderer: Handsontable.AutocompleteRenderer //displays small gray arrow on right side of the cell
};

Handsontable.HandsontableCell = {
  editor: Handsontable.HandsontableEditor,
  renderer: Handsontable.AutocompleteRenderer //displays small gray arrow on right side of the cell
};

//here setup the friendly aliases that are used by cellProperties.type
Handsontable.cellTypes = {
  text: Handsontable.TextCell,
  date: Handsontable.DateCell,
  numeric: Handsontable.NumericCell,
  checkbox: Handsontable.CheckboxCell,
  autocomplete: Handsontable.AutocompleteCell,
  handsontable: Handsontable.HandsontableCell
};

//here setup the friendly aliases that are used by cellProperties.renderer and cellProperties.editor
Handsontable.cellLookup = {
  renderer: {
    text: Handsontable.TextRenderer,
    numeric: Handsontable.NumericRenderer,
    checkbox: Handsontable.CheckboxRenderer,
    autocomplete: Handsontable.AutocompleteRenderer
  },
  editor: {
    text: Handsontable.TextEditor,
    date: Handsontable.DateEditor,
    checkbox: Handsontable.CheckboxEditor,
    autocomplete: Handsontable.AutocompleteEditor,
    handsontable: Handsontable.HandsontableEditor
  },
  validator: {
    numeric: Handsontable.NumericValidator,
    autocomplete: Handsontable.AutocompleteValidator
  }
};
Handsontable.PluginHookClass = (function () {

  var Hooks = function () {
    return {
      // Hooks
      beforeInitWalkontable : [],

      beforeInit : [],
      beforeRender : [],
      beforeChange : [],
      beforeValidate: [],
      beforeGet : [],
      beforeSet : [],
      beforeGetCellMeta : [],
      beforeAutofill : [],
      beforeKeyDown : [],

      afterInit : [],
      afterLoadData : [],
      afterRender : [],
      afterChange : [],
      afterValidate: [],
      afterGetCellMeta : [],
      afterGetColHeader : [],
      afterGetColWidth : [],
      afterDestroy : [],
      afterRemoveRow : [],
      afterCreateRow : [],
      afterRemoveCol : [],
      afterCreateCol : [],
      afterColumnResize : [],
      afterColumnMove : [],
      afterDeselect : [],
      afterSelection : [],
      afterSelectionByProp : [],
      afterSelectionEnd : [],
      afterSelectionEndByProp : [],
      afterCopyLimit : [],

      // Modifiers
      modifyCol : []
    }
  };

  var legacy = {
      onBeforeChange: "beforeChange",
      onChange: "afterChange",
      onCreateRow: "afterCreateRow",
      onCreateCol: "afterCreateCol",
      onSelection: "afterSelection",
      onCopyLimit: "afterCopyLimit",
      onSelectionEnd: "afterSelectionEnd",
      onSelectionByProp: "afterSelectionByProp",
      onSelectionEndByProp: "afterSelectionEndByProp"
    };

  function PluginHookClass () {

    this.hooks = {
      once : Hooks(),
      persistent : Hooks()
    };

    this.legacy = legacy;

  }

  var addHook = function (type) {
    return function (key, fn) {
      // provide support for old versions of HOT
      if (key in legacy) {
        key = legacy[key];
      }

      if (typeof this.hooks[type][key] === "undefined") {
        this.hooks[type][key] = [];
      }

      if (fn instanceof Array) {
        for (var i = 0, len = fn.length; i < len; i++) {
          this.hooks[type][key].push(fn[i]);
        }
      } else {
        this.hooks[type][key].push(fn);
      }

      return this;
    };
  };

  PluginHookClass.prototype.add  = addHook('persistent');
  PluginHookClass.prototype.once = addHook('once');

  PluginHookClass.prototype.remove = function (key, fn) {
    var status = false
      , hookTypes = ['persistent', 'once']
      , type, x, lenx, i, leni;

    // provide support for old versions of HOT
    if (key in legacy) {
      key = legacy[key];
    }

    for (x = 0, lenx = hookTypes.length; x < lenx; x++) {
      type = hookTypes[x];
      if (typeof this.hooks[type][key] !== 'undefined') {

        for (i = 0, leni = this.hooks[type][key].length; i < leni; i++) {
          if (this.hooks[type][key][i] == fn) {
            this.hooks[type][key].splice(i, 1);
            status = true;
            break;
          }
        }

      }
    }

    return status;
  };

  PluginHookClass.prototype.run = function (instance, key, p1, p2, p3, p4, p5) {
    var hookTypes = ['persistent', 'once']
      , type, x, lenx, i, leni;

    // provide support for old versions of HOT
    if (key in legacy) {
      key = legacy[key];
    }

    //performance considerations - http://jsperf.com/call-vs-apply-for-a-plugin-architecture
    for (x = 0, lenx = hookTypes.length; x < lenx; x++) {
      type = hookTypes[x];
      if (typeof this.hooks[type][key] !== 'undefined') {

        for (i = 0, leni = this.hooks[type][key].length; i < leni; i++) {
          this.hooks[type][key][i].call(instance, p1, p2, p3, p4, p5);

          if (type === 'once') {
            this.hooks[type][key].splice(i, 1);
          }
        }

      }
    }
  };

  PluginHookClass.prototype.execute = function (instance, key, p1, p2, p3, p4, p5) {
    var hookTypes = ['persistent', 'once']
      , type, x, lenx, i, leni, res;

    // provide support for old versions of HOT
    if (key in legacy) {
      key = legacy[key];
    }

    //performance considerations - http://jsperf.com/call-vs-apply-for-a-plugin-architecture
    for (x = 0, lenx = hookTypes.length; x < lenx; x++) {
      type = hookTypes[x];
      if (typeof this.hooks[type][key] !== 'undefined') {

        for (i = 0, leni = this.hooks[type][key].length; i < leni; i++) {

          res = this.hooks[type][key][i].call(instance, p1, p2, p3, p4, p5);
          if (res !== void 0) {
            p1 = res;
          }

          if (type === 'once') {
            this.hooks[type][key].splice(i, 1);
          }
        }

      }
    }

    return p1;
  };

  return PluginHookClass;

})();

Handsontable.PluginHooks = new Handsontable.PluginHookClass();
function HandsontableAutoColumnSize() {
  var that = this
    , instance
    , sampleCount = 5; //number of samples to take of each value length

  this.beforeInit = function () {
    this.autoColumnWidths = [];
    this.autoColumnSizeTmp = {
      thead: null,
      theadTh: null,
      theadStyle: null,
      tbody: null,
      tbodyTd: null,
      noRenderer: null,
      noRendererTd: null,
      renderer: null,
      rendererTd: null,
      container: null,
      containerStyle: null
    };
  };

  this.determineColumnWidth = function (col) {
    var tmp = instance.autoColumnSizeTmp
      , d;

    if (!tmp.container) {
      d = document;

      tmp.thead = d.createElement('table');
      tmp.thead.appendChild(d.createElement('thead')).appendChild(d.createElement('tr')).appendChild(d.createElement('th'));
      tmp.theadTh = tmp.thead.getElementsByTagName('th')[0];

      tmp.thead.className = 'htTable';
      tmp.theadStyle = tmp.thead.style;
      tmp.theadStyle.tableLayout = 'auto';
      tmp.theadStyle.width = 'auto';

      tmp.tbody = tmp.thead.cloneNode(false);
      tmp.tbody.appendChild(d.createElement('tbody')).appendChild(d.createElement('tr')).appendChild(d.createElement('td'));
      tmp.tbodyTd = tmp.tbody.getElementsByTagName('td')[0];

      tmp.noRenderer = tmp.tbody.cloneNode(true);
      tmp.noRendererTd = tmp.noRenderer.getElementsByTagName('td')[0];

      tmp.renderer = tmp.tbody.cloneNode(true);
      tmp.rendererTd = tmp.renderer.getElementsByTagName('td')[0];

      tmp.container = d.createElement('div');
      tmp.container.className = instance.rootElement[0].className + ' hidden';
      tmp.containerStyle = tmp.container.style;

      tmp.container.appendChild(tmp.thead);
      tmp.container.appendChild(tmp.tbody);
      tmp.container.appendChild(tmp.noRenderer);
      tmp.container.appendChild(tmp.renderer);

      instance.rootElement[0].parentNode.appendChild(tmp.container);
    }

    tmp.container.className = instance.rootElement[0].className + ' hidden';
    var cls = instance.$table[0].className;
    tmp.thead.className = cls;
    tmp.tbody.className = cls;

    var rows = instance.countRows();
    var samples = {};
    var maxLen = 0;
    for (var r = 0; r < rows; r++) {
      var value = Handsontable.helper.stringify(instance.getDataAtCell(r, col));
      var len = value.length;
      if (len > maxLen) {
        maxLen = len;
      }
      if (!samples[len]) {
        samples[len] = {
          needed: sampleCount,
          strings: []
        };
      }
      if (samples[len].needed) {
        samples[len].strings.push(value);
        samples[len].needed--;
      }
    }

    var settings = instance.getSettings();
    if (settings.colHeaders) {
      instance.view.appendColHeader(col, tmp.theadTh); //TH innerHTML
    }

    var txt = '';
    for (var i in samples) {
      if (samples.hasOwnProperty(i)) {
        for (var j = 0, jlen = samples[i].strings.length; j < jlen; j++) {
          txt += samples[i].strings[j] + '<br>';
        }
      }
    }
    tmp.tbodyTd.innerHTML = txt; //TD innerHTML

    instance.view.wt.wtDom.empty(tmp.rendererTd);
    instance.view.wt.wtDom.empty(tmp.noRendererTd);

    tmp.containerStyle.display = 'block';

    var width = instance.view.wt.wtDom.outerWidth(tmp.container);

    var cellProperties = instance.getCellMeta(0, col);
    if (cellProperties.renderer) {
      var str = 9999999999;

      tmp.noRendererTd.appendChild(document.createTextNode(str));
      var renderer = Handsontable.helper.getCellMethod('renderer', cellProperties.renderer);
      renderer(instance, tmp.rendererTd, 0, col, instance.colToProp(col), str, cellProperties);

      width += instance.view.wt.wtDom.outerWidth(tmp.renderer) - instance.view.wt.wtDom.outerWidth(tmp.noRenderer); //add renderer overhead to the calculated width
    }

    tmp.containerStyle.display = 'none';

    return width;
  };

  this.determineColumnsWidth = function () {
    instance = this;
    var settings = this.getSettings();
    if (settings.autoColumnSize || !settings.colWidths) {
      var cols = this.countCols();
      for (var c = 0; c < cols; c++) {
        this.autoColumnWidths[c] = that.determineColumnWidth(c);
      }
    }
  };

  this.getColWidth = function (col, response) {
    if (this.autoColumnWidths[col] && this.autoColumnWidths[col] > response.width) {
      response.width = this.autoColumnWidths[col];
    }
  };

  this.afterDestroy = function () {
    instance = this;
    if (instance.autoColumnSizeTmp.container) {
      instance.autoColumnSizeTmp.container.parentNode.removeChild(instance.autoColumnSizeTmp.container);
    }
  };
}
var htAutoColumnSize = new HandsontableAutoColumnSize();

Handsontable.PluginHooks.add('beforeInit', htAutoColumnSize.beforeInit);
Handsontable.PluginHooks.add('beforeRender', htAutoColumnSize.determineColumnsWidth);
Handsontable.PluginHooks.add('afterGetColWidth', htAutoColumnSize.getColWidth);
Handsontable.PluginHooks.add('afterDestroy', htAutoColumnSize.afterDestroy);

/**
 * This plugin sorts the view by a column (but does not sort the data source!)
 * @constructor
 */
function HandsontableColumnSorting() {
  var plugin = this;
  var sortingEnabled;

  this.afterInit = function () {
    var instance = this;
    if (this.getSettings().columnSorting) {
      this.sortIndex = [];
      this.rootElement.on('click.handsontable', '.columnSorting', function (e) {
        var $target = $(e.target);
        if ($target.is('.columnSorting')) {
          var col = $target.closest('th').index();
          if (instance.getSettings().rowHeaders) {
            col--;
          }
          if (instance.sortColumn === col) {
            instance.sortOrder = !instance.sortOrder;
          }
          else {
            instance.sortColumn = col;
            instance.sortOrder = true;
          }
          plugin.sort.call(instance);
          instance.render();
        }
      });
    }
  };

  this.sort = function () {
    sortingEnabled = false;
    var instance = this;
    this.sortIndex.length = 0;
    //var data = this.getData();
    for (var i = 0, ilen = this.countRows(); i < ilen; i++) {
      //this.sortIndex.push([i, data[i][this.sortColumn]]);
      this.sortIndex.push([i, instance.getDataAtCell(i, this.sortColumn)]);
    }
    this.sortIndex.sort(function (a, b) {
      if (a[1] === b[1]) {
        return 0;
      }
      if (a[1] === null) {
        return 1;
      }
      if (b[1] === null) {
        return -1;
      }
      if (a[1] < b[1]) return instance.sortOrder ? -1 : 1;
      if (a[1] > b[1]) return instance.sortOrder ? 1 : -1;
      return 0;
    });
    sortingEnabled = true;
  };

  this.translateRow = function (getVars) {
    if (sortingEnabled && this.sortIndex && this.sortIndex.length) {
      getVars.row = this.sortIndex[getVars.row][0];
    }
  };

  this.getColHeader = function (col, TH) {
    if (this.getSettings().columnSorting) {
      $(TH).find('span.colHeader')[0].className += ' columnSorting';
    }
  };
}
var htSortColumn = new HandsontableColumnSorting();

Handsontable.PluginHooks.add('afterInit', htSortColumn.afterInit);
Handsontable.PluginHooks.add('beforeGet', htSortColumn.translateRow);
Handsontable.PluginHooks.add('beforeSet', htSortColumn.translateRow);
Handsontable.PluginHooks.add('afterGetColHeader', htSortColumn.getColHeader);
function createContextMenu() {
  var instance = this
      , selectorId = instance.rootElement[0].id
      , allItems = {
        "row_above": {name: "Insert row above", disabled: isDisabled},
        "row_below": {name: "Insert row below", disabled: isDisabled},
        "hsep1": "---------",
        "col_left": {name: "Insert column on the left", disabled: isDisabled},
        "col_right": {name: "Insert column on the right", disabled: isDisabled},
        "hsep2": "---------",
        "remove_row": {name: "Remove row", disabled: isDisabled},
        "remove_col": {name: "Remove column", disabled: isDisabled},
        "hsep3": "---------",
        "undo": {name: "Undo", disabled: function () {
          return !instance.isUndoAvailable();
        }},
        "redo": {name: "Redo", disabled: function () {
          return !instance.isRedoAvailable();
        }}
      }
      , defaultOptions = {
          selector : "#" + selectorId + ' table, #' + selectorId + ' div',
          trigger  : 'right',
          callback : onContextClick
        }
      , options = {}
      , i
      , ilen
      , settings = instance.getSettings();

  function onContextClick(key) {
    var corners = instance.getSelected(); //[top left row, top left col, bottom right row, bottom right col]

    if (!corners) {
      return; //needed when there are 2 grids on a page
    }

    switch (key) {
      case "row_above":
        instance.alter("insert_row", corners[0]);
        break;

      case "row_below":
        instance.alter("insert_row", corners[2] + 1);
        break;

      case "col_left":
        instance.alter("insert_col", corners[1]);
        break;

      case "col_right":
        instance.alter("insert_col", corners[3] + 1);
        break;

      case "remove_row":
        instance.alter(key, corners[0], (corners[2] - corners[0]) + 1);
        break;

      case "remove_col":
        instance.alter(key, corners[1], (corners[3] - corners[1]) + 1);
        break;

      case "undo":
        instance.undo();
        break;

      case "redo":
        instance.redo();
        break;
    }
  }

  function isDisabled(key) {
    //TODO rewrite
    /*if (instance.blockedCols.main.find('th.htRowHeader.active').length && (key === "remove_col" || key === "col_left" || key === "col_right")) {
     return true;
     }
     else if (instance.blockedRows.main.find('th.htColHeader.active').length && (key === "remove_row" || key === "row_above" || key === "row_below")) {
     return true;
     }
     else*/
    if (instance.countRows() >= instance.getSettings().maxRows && (key === "row_above" || key === "row_below")) {
      return true;
    }
    else if (instance.countCols() >= instance.getSettings().maxCols && (key === "col_left" || key === "col_right")) {
      return true;
    }
    else {
      return false;
    }
  }

  if (!settings.contextMenu) {
    return;
  }
  else if (settings.contextMenu === true) { //contextMenu is true
    options.items = allItems;
  }
  else if (Object.prototype.toString.apply(settings.contextMenu) === '[object Array]') { //contextMenu is an array
    options.items = {};
    for (i = 0, ilen = settings.contextMenu.length; i < ilen; i++) {
      var key = settings.contextMenu[i];
      if (typeof allItems[key] === 'undefined') {
        throw new Error('Context menu key "' + key + '" is not recognised');
      }
      options.items[key] = allItems[key];
    }
  }
  else if (Object.prototype.toString.apply(settings.contextMenu) === '[object Object]') { //contextMenu is an options object as defined in http://medialize.github.com/jQuery-contextMenu/docs.html
    options = settings.contextMenu;
    if (options.items) {
      for (i in options.items) {
        if (options.items.hasOwnProperty(i) && allItems[i]) {
          if (typeof options.items[i] === 'string') {
            options.items[i] = allItems[i];
          }
          else {
            options.items[i] = $.extend(true, allItems[i], options.items[i]);
          }
        }
      }
    }
    else {
      options.items = allItems;
    }

    if (options.callback) {
      var handsontableCallback = defaultOptions.callback;
      var customCallback = options.callback;
      options.callback = function (key, options) {
        handsontableCallback(key, options);
        customCallback(key, options);
      }
    }
  }

  if (!selectorId) {
    throw new Error("Handsontable container must have an id");
  }

  $.contextMenu($.extend(true, defaultOptions, options));
}

function destroyContextMenu() {
  var id = this.rootElement[0].id;
  $.contextMenu('destroy', "#" + id + ' table, #' + id + ' div');
}

Handsontable.PluginHooks.add('afterInit', createContextMenu);
Handsontable.PluginHooks.add('afterDestroy', destroyContextMenu);
/**
 * This plugin adds support for legacy features, deprecated APIs, etc.
 */

/**
 * Support for old autocomplete syntax
 * For old syntax, see: https://github.com/warpech/jquery-handsontable/blob/8c9e701d090ea4620fe08b6a1a048672fadf6c7e/README.md#defining-autocomplete
 */
Handsontable.PluginHooks.add('beforeGetCellMeta', function (row, col, cellProperties) {
  var settings = this.getSettings(), data = this.getData(), i, ilen, a;
  if (settings.autoComplete) {
    for (i = 0, ilen = settings.autoComplete.length; i < ilen; i++) {
      if (settings.autoComplete[i].match(row, col, data)) {
        if (typeof cellProperties.type === 'undefined') {
          cellProperties.type = Handsontable.AutocompleteCell;
        }
        else {
          if (typeof cellProperties.type.renderer === 'undefined') {
            cellProperties.type.renderer = Handsontable.AutocompleteCell.renderer;
          }
          if (typeof cellProperties.type.editor === 'undefined') {
            cellProperties.type.editor = Handsontable.AutocompleteCell.editor;
          }
        }
        for (a in settings.autoComplete[i]) {
          if (settings.autoComplete[i].hasOwnProperty(a) && a !== 'match' && typeof cellProperties[i] === 'undefined') {
            if (a === 'source') {
              cellProperties[a] = settings.autoComplete[i][a](row, col);
            }
            else {
              cellProperties[a] = settings.autoComplete[i][a];
            }
          }
        }
        break;
      }
    }
  }
});
function HandsontableManualColumnMove() {
  var instance
    , pressed
    , startCol
    , endCol
    , startX
    , startOffset;

  var ghost = document.createElement('DIV')
    , ghostStyle = ghost.style;

  ghost.className = 'ghost';
  ghostStyle.position = 'absolute';
  ghostStyle.top = '25px';
  ghostStyle.left = 0;
  ghostStyle.width = '10px';
  ghostStyle.height = '10px';
  ghostStyle.backgroundColor = '#CCC';
  ghostStyle.opacity = 0.7;

  $(document).mousemove(function (e) {
    if (pressed) {
      ghostStyle.left = startOffset + e.pageX - startX + 6 + 'px';
      if (ghostStyle.display === 'none') {
        ghostStyle.display = 'block';
      }
    }
  });

  $(document).mouseup(function () {
    if (pressed) {
      if (startCol < endCol) {
        endCol--;
      }
      if (instance.getSettings().rowHeaders) {
        startCol--;
        endCol--;
      }
      instance.manualColumnPositions.splice(endCol, 0, instance.manualColumnPositions.splice(startCol, 1)[0]);
      $('.manualColumnMover.active').removeClass('active');
      pressed = false;
      instance.forceFullRender = true;
      instance.view.render(); //updates all
      ghostStyle.display = 'none';
      instance.PluginHooks.run('afterColumnMove', startCol, endCol);
    }
  });

  this.beforeInit = function () {
    this.manualColumnPositions = [];
  };

  this.afterInit = function () {
    if (this.getSettings().manualColumnMove) {
      var that = this;
      this.rootElement.on('mousedown.handsontable', '.manualColumnMover', function (e) {
        instance = that;

        var $resizer = $(e.target);
        var th = $resizer.closest('th');
        startCol = th.index();
        pressed = true;
        startX = e.pageX;

        var $table = that.rootElement.find('.htCore');
        $table.parent()[0].appendChild(ghost);
        ghostStyle.width = $resizer.parent().width() + 'px';
        ghostStyle.height = $table.height() + 'px';
        startOffset = parseInt(th.offset().left - $table.offset().left, 10);
        ghostStyle.left = startOffset + 6 + 'px';
      });
      this.rootElement.on('mouseenter.handsontable', 'td, th', function () {
        if (pressed) {
          $('.manualColumnMover.active').removeClass('active');
          var $ths = that.rootElement.find('thead th');
          endCol = $(this).index();
          var $hover = $ths.eq(endCol).find('.manualColumnMover').addClass('active');
          $ths.not($hover).removeClass('active');
        }
      });
    }
  };

  this.modifyCol = function (col) {
    //TODO test performance: http://jsperf.com/object-wrapper-vs-primitive/2
    if (this.getSettings().manualColumnMove) {
      if (typeof this.manualColumnPositions[col] === 'undefined') {
        this.manualColumnPositions[col] = col;
      }
      return this.manualColumnPositions[col];
    }
    return col;
  };

  this.getColHeader = function (col, TH) {
    if (this.getSettings().manualColumnMove) {
      var DIV = document.createElement('DIV');
      DIV.className = 'manualColumnMover';
      TH.firstChild.appendChild(DIV);
    }
  };
}
var htManualColumnMove = new HandsontableManualColumnMove();

Handsontable.PluginHooks.add('beforeInit', htManualColumnMove.beforeInit);
Handsontable.PluginHooks.add('afterInit', htManualColumnMove.afterInit);
Handsontable.PluginHooks.add('afterGetColHeader', htManualColumnMove.getColHeader);
Handsontable.PluginHooks.add('modifyCol', htManualColumnMove.modifyCol);

function HandsontableManualColumnResize() {
  var pressed
    , currentCol
    , currentWidth
    , autoresizeTimeout
    , instance
    , newSize
    , start
    , startX
    , startWidth
    , startOffset
    , dblclick = 0
    , resizer = document.createElement('DIV')
    , line = document.createElement('DIV')
    , lineStyle = line.style;

  resizer.className = 'manualColumnResizer';

  line.className = 'manualColumnResizerLine';
  lineStyle.position ='absolute';
  lineStyle.top = 0;
  lineStyle.left = 0;
  lineStyle.width = 0;
  lineStyle.borderRight = '1px dashed #777';
  line.appendChild(resizer);

  $(document).mousemove(function (e) {
    if (pressed) {
      currentWidth = startWidth + (e.pageX - startX);
      newSize = setManualSize(currentCol, currentWidth); //save col width
      lineStyle.left = startOffset + currentWidth - 1 + 'px';
      if (lineStyle.display === 'none') {
        lineStyle.display = 'block';
      }
    }
  });

  $(document).mouseup(function () {
    if (pressed) {
      $('.manualColumnResizer.active').removeClass('active');
      pressed = false;
      instance.forceFullRender = true;
      instance.view.render(); //updates all
      lineStyle.display = 'none';
      instance.PluginHooks.run('afterColumnResize', currentCol, newSize);
    }
  });

  this.beforeInit = function () {
    this.manualColumnWidths = [];
  };

  this.afterInit = function () {
    if (this.getSettings().manualColumnResize) {
      var that = this;

      this.rootElement.on('mousedown.handsontable', '.manualColumnResizer', function (e) {
        if (autoresizeTimeout == null) {
          autoresizeTimeout = setTimeout(function () {
            if (dblclick >= 2) {
              setManualSize(currentCol, htAutoColumnSize.determineColumnWidth.call(instance, currentCol));
              instance.PluginHooks.run('afterColumnResize', currentCol, newSize);
            }
            dblclick = 0;
            autoresizeTimeout = null;
          }, 500);
        }
        dblclick++;
      });

      this.rootElement.on('mousedown.handsontable', '.manualColumnResizer', function (e) {
        var _resizer = e.target,
            $table   = that.rootElement.find('.htCore'),
            $grandpa = $(_resizer.parentNode.parentNode);

        instance = that;
        currentCol = _resizer.getAttribute('rel');
        start = $(that.rootElement[0].getElementsByTagName('col')[$grandpa.index()]);
        pressed = true;
        startX = e.pageX;
        startWidth = start.width();
        currentWidth = startWidth;

        _resizer.className += ' active';

        lineStyle.height = $table.height() + 'px';
        $table.parent()[0].appendChild(line);
        startOffset = parseInt($grandpa.offset().left - $table.offset().left, 10);
        lineStyle.left = startOffset + currentWidth - 1 + 'px';
      });
    }
  };

  var setManualSize = function (col, width) {
    width = Math.max(width, 20);
    width = Math.min(width, 500);
    instance.manualColumnWidths[col] = width;
    return width;
  };

  this.getColHeader = function (col, TH) {
    if (this.getSettings().manualColumnResize) {
      var DIV = document.createElement('DIV');
      DIV.className = 'manualColumnResizer';
      DIV.setAttribute('rel', col);
      TH.firstChild.appendChild(DIV);
    }
  };

  this.getColWidth = function (col, response) {
    if (this.getSettings().manualColumnResize && this.manualColumnWidths[col]) {
      response.width = this.manualColumnWidths[col];
    }
  };
}
var htManualColumnResize = new HandsontableManualColumnResize();

Handsontable.PluginHooks.add('beforeInit', htManualColumnResize.beforeInit);
Handsontable.PluginHooks.add('afterInit', htManualColumnResize.afterInit);
Handsontable.PluginHooks.add('afterGetColHeader', htManualColumnResize.getColHeader);
Handsontable.PluginHooks.add('afterGetColWidth', htManualColumnResize.getColWidth);

function HandsontableObserveChanges() {
  // begin shim code
  // fragments from https://github.com/Starcounter-Jack/JSON-Patch/blob/master/src/json-patch-duplex.js
  //
  // json-patch.js 0.3
  // (c) 2013 Joachim Wester
  // MIT license
  var observeOps = {
    'new': function (patches, path) {
      var patch = {
        op: "add",
        path: path + "/" + this.name,
        value: this.object[this.name]
      };
      patches.push(patch);
    },
    deleted: function (patches, path) {
      var patch = {
        op: "remove",
        path: path + "/" + this.name
      };
      patches.push(patch);
    },
    updated: function (patches, path) {
      var patch = {
        op: "replace",
        path: path + "/" + this.name,
        value: this.object[this.name]
      };
      patches.push(patch);
    }
  };

  function markPaths(observer, node) {
    for (var key in node) {
      if (node.hasOwnProperty(key)) {
        var kid = node[key];
        if (kid instanceof Object) {
          Object.unobserve(kid, observer);
          kid.____Path = node.____Path + "/" + key;
          markPaths(observer, kid);
        }
      }
    }
  }

  function clearPaths(observer, node) {
    delete node.____Path;
    Object.observe(node, observer);
    for (var i = 0, nodeLen = node.length; i < nodeLen; i++) {
      var kid = node[i];
      if (kid instanceof Object) {
        clearPaths(observer, kid);
      }
    }
  }

  var beforeDict = [];
  var callbacks = [];

  function observe(obj, callback) {
    var patches = [];
    var root = obj;
    if (Object.observe) {
      var observer = function (arr) {
        if (!root.___Path) {
          Object.unobserve(root, observer);
          root.____Path = "";
          markPaths(observer, root);

          for (var index = 0, arrLen = arr.length; i < arrLen; i++) {
            var elem = arr[index];

            if (elem.name != "____Path") {
              observeOps[elem.type].call(elem, patches, elem.object.____Path);
            }
          }

          clearPaths(observer, root);
        }
        if (callback) {
          callback.call(patches);
        }
      };
    } else {
      observer = {
      };
      var mirror;
      for (var i = 0, ilen = beforeDict.length; i < ilen; i++) {
        if (beforeDict[i].obj === obj) {
          mirror = beforeDict[i];
          break;
        }
      }
      if (!mirror) {
        mirror = {
          obj: obj
        };
        beforeDict.push(mirror);
      }

      mirror.value = deepCopy(obj);

      if (callback) {
        callbacks.push(callback);
        var next;
        var intervals = [
          100
        ];
        var currentInterval = 0;
        var dirtyCheck = function () {
          var temp = generate(observer);
          if (temp.length > 0) {
            observer.patches = [];
            callback.call(null, temp);
          }
        };
        var fastCheck = function () {
          clearTimeout(next);
          next = setTimeout(function () {
            dirtyCheck();
            currentInterval = 0;
            next = setTimeout(slowCheck, intervals[currentInterval++]);
          }, 0);
        };
        var slowCheck = function () {
          dirtyCheck();
          if (currentInterval == intervals.length) {
            currentInterval = intervals.length - 1;
          }
          next = setTimeout(slowCheck, intervals[currentInterval++]);
        };

        if (window.addEventListener) {
          window.addEventListener('mousedown', fastCheck);
          window.addEventListener('mouseup', fastCheck);
          window.addEventListener('keydown', fastCheck);
        } else {
          //IE8 has different syntax
          window.attachEvent('onmousedown', fastCheck);
          window.attachEvent('onmouseup', fastCheck);
          window.attachEvent('onkeydown', fastCheck);
        }

        next = setTimeout(slowCheck, intervals[currentInterval++]);
      }
    }
    observer.patches = patches;
    observer.object = obj;
    return _observe(observer, obj, patches);
  }

  /// Listen to changes on an object tree, accumulate patches
  function _observe(observer, obj, patches) {
    if (Object.observe) {
      Object.observe(obj, observer);
    }
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var v = obj[key];
        if (v && typeof (v) === "object") {
          _observe(observer, v, patches);
        }
      }
    }
    return observer;
  }

  function generate(observer) {
    if (Object.observe) {
      Object.deliverChangeRecords(observer);
    } else {
      var mirror;
      for (var i = 0, ilen = beforeDict.length; i < ilen; i++) {
        if (beforeDict[i].obj === observer.object) {
          mirror = beforeDict[i];
          break;
        }
      }
      _generate(mirror.value, observer.object, observer.patches, "");
    }
    return observer.patches;
  }

  function _generate(mirror, obj, patches, path) {
    var newKeys = []
      , oldKeys = []
      , key;

    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        newKeys.push(key);
      }
    }

    for (key in mirror) {
      if (mirror.hasOwnProperty(key)) {
        oldKeys.push(key);
      }
    }

    var changed = false;
    var deleted = false;
    var t;
    for (t = 0; t < oldKeys.length; t++) {
      key = oldKeys[t];
      var oldVal = mirror[key];
      if (obj.hasOwnProperty(key)) {
        var newVal = obj[key];
        if (oldVal instanceof Object) {
          _generate(oldVal, newVal, patches, path + "/" + key);
        } else {
          if (oldVal != newVal) {
            changed = true;
            patches.push({
              op: "replace",
              path: path + "/" + key,
              value: newVal
            });
            mirror[key] = newVal;
          }
        }
      } else {
        patches.push({
          op: "remove",
          path: path + "/" + key
        });
        deleted = true;
      }
    }
    if (!deleted && newKeys.length == oldKeys.length) {
      return;
    }
    for (t = 0; t < newKeys.length; t++) {
      key = newKeys[t];
      if (!mirror.hasOwnProperty(key)) {
        patches.push({
          op: "add",
          path: path + "/" + key,
          value: obj[key]
        });
      }
    }
  }

  //end shim code


  this.afterLoadData = function () {
    if (!this.observer && this.getSettings().observeChanges) {
      var that = this;
      this.observer = observe(this.getData(), function () {
        that.render();
      });
    }
  };

  /*
   Description: Performs JSON-safe deep cloning. Equivalent of JSON.parse(JSON.stringify()).
   Based on deepClone7() by Kyle Simpson (https://github.com/getify)
   Source: http://jsperf.com/deep-cloning-of-objects,
   http://jsperf.com/structured-clone-objects/2
   https://developer.mozilla.org/en-US/docs/Web/Guide/DOM/The_structured_clone_algorithm
   */

  function deepCopy(objToBeCopied) {
    if (objToBeCopied === null || !(objToBeCopied instanceof Object)) {
      return objToBeCopied;
    }
    var copiedObj, fConstr = objToBeCopied.constructor;
    copiedObj = new fConstr();
    for (var sProp in objToBeCopied) {
      if (objToBeCopied.hasOwnProperty(sProp)) {
        copiedObj[sProp] = deepCopy(objToBeCopied[sProp]);
      }
    }
    return copiedObj;
  }

}
var htObserveChanges = new HandsontableObserveChanges();

Handsontable.PluginHooks.add('afterLoadData', htObserveChanges.afterLoadData);
/*
 * jQuery.fn.autoResize 1.1+
 * --
 * https://github.com/warpech/jQuery.fn.autoResize
 *
 * This fork differs from others in a way that it autoresizes textarea in 2-dimensions (horizontally and vertically).
 * It was originally forked from alexbardas's repo but maybe should be merged with dpashkevich's repo in future.
 *
 * originally forked from:
 * https://github.com/jamespadolsey/jQuery.fn.autoResize
 * which is now located here:
 * https://github.com/alexbardas/jQuery.fn.autoResize
 * though the mostly maintained for is here:
 * https://github.com/dpashkevich/jQuery.fn.autoResize/network
 *
 * --
 * This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

(function($){

  autoResize.defaults = {
    onResize: function(){},
    animate: {
      duration: 200,
      complete: function(){}
    },
    extraSpace: 50,
    minHeight: 'original',
    maxHeight: 500,
    minWidth: 'original',
    maxWidth: 500
  };

  autoResize.cloneCSSProperties = [
    'lineHeight', 'textDecoration', 'letterSpacing',
    'fontSize', 'fontFamily', 'fontStyle', 'fontWeight',
    'textTransform', 'textAlign', 'direction', 'wordSpacing', 'fontSizeAdjust',
    'padding'
  ];

  autoResize.cloneCSSValues = {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
    overflow: 'hidden',
    border: '1px solid black',
    padding: '0.49em' //this must be about the width of caps W character
  };

  autoResize.resizableFilterSelector = 'textarea,input:not(input[type]),input[type=text],input[type=password]';

  autoResize.AutoResizer = AutoResizer;

  $.fn.autoResize = autoResize;

  function autoResize(config) {
    this.filter(autoResize.resizableFilterSelector).each(function(){
      new AutoResizer( $(this), config );
    });
    return this;
  }

  function AutoResizer(el, config) {

    if(this.clones) return;

    this.config = $.extend({}, autoResize.defaults, config);

    this.el = el;

    this.nodeName = el[0].nodeName.toLowerCase();

    this.previousScrollTop = null;

    if (config.maxWidth === 'original') config.maxWidth = el.width();
    if (config.minWidth === 'original') config.minWidth = el.width();
    if (config.maxHeight === 'original') config.maxHeight = el.height();
    if (config.minHeight === 'original') config.minHeight = el.height();

    if (this.nodeName === 'textarea') {
      el.css({
        resize: 'none',
        overflowY: 'hidden'
      });
    }

    el.data('AutoResizer', this);

    this.createClone();
    this.injectClone();
    this.bind();

  }

  AutoResizer.prototype = {

    bind: function() {

      var check = $.proxy(function(){
        this.check();
        return true;
      }, this);

      this.unbind();

      this.el
        .bind('keyup.autoResize', check)
        //.bind('keydown.autoResize', check)
        .bind('change.autoResize', check);

      this.check(null, true);

    },

    unbind: function() {
      this.el.unbind('.autoResize');
    },

    createClone: function() {

      var el = this.el,
        self = this,
        config = this.config;

      this.clones = $();

      if (config.minHeight !== 'original' || config.maxHeight !== 'original') {
        this.hClone = el.clone().height('auto');
        this.clones = this.clones.add(this.hClone);
      }
      if (config.minWidth !== 'original' || config.maxWidth !== 'original') {
        this.wClone = $('<div/>').width('auto').css({
          whiteSpace: 'nowrap',
          'float': 'left'
        });
        this.clones = this.clones.add(this.wClone);
      }

      $.each(autoResize.cloneCSSProperties, function(i, p){
        self.clones.css(p, el.css(p));
      });

      this.clones
        .removeAttr('name')
        .removeAttr('id')
        .attr('tabIndex', -1)
        .css(autoResize.cloneCSSValues);

    },

    check: function(e, immediate) {

      var config = this.config,
        wClone = this.wClone,
        hClone = this.hClone,
        el = this.el,
        value = el.val();

      if (wClone) {

        wClone.text(value);

        // Calculate new width + whether to change
        var cloneWidth = wClone.outerWidth(),
          newWidth = (cloneWidth + config.extraSpace) >= config.minWidth ?
            cloneWidth + config.extraSpace : config.minWidth,
          currentWidth = el.width();

        newWidth = Math.min(newWidth, config.maxWidth);

        if (
          (newWidth < currentWidth && newWidth >= config.minWidth) ||
            (newWidth >= config.minWidth && newWidth <= config.maxWidth)
          ) {

          config.onResize.call(el);

          el.scrollLeft(0);

          config.animate && !immediate ?
            el.stop(1,1).animate({
              width: newWidth
            }, config.animate)
            : el.width(newWidth);

        }

      }

      if (hClone) {

        if (newWidth) {
          hClone.width(newWidth);
        }

        hClone.height(0).val(value).scrollTop(10000);

        var scrollTop = hClone[0].scrollTop + config.extraSpace;

        // Don't do anything if scrollTop hasen't changed:
        if (this.previousScrollTop === scrollTop) {
          return;
        }

        this.previousScrollTop = scrollTop;

        if (scrollTop >= config.maxHeight) {
          el.css('overflowY', '');
          return;
        }

        el.css('overflowY', 'hidden');

        if (scrollTop < config.minHeight) {
          scrollTop = config.minHeight;
        }

        config.onResize.call(el);

        // Either animate or directly apply height:
        config.animate && !immediate ?
          el.stop(1,1).animate({
            height: scrollTop
          }, config.animate)
          : el.height(scrollTop);
      }
    },

    destroy: function() {
      this.unbind();
      this.el.removeData('AutoResizer');
      this.clones.remove();
      delete this.el;
      delete this.hClone;
      delete this.wClone;
      delete this.clones;
    },

    injectClone: function() {
      (
        autoResize.cloneContainer ||
          (autoResize.cloneContainer = $('<arclones/>').appendTo('body'))
        ).empty().append(this.clones); //this should be refactored so that a node is never cloned more than once
    }

  };

})(jQuery);
/**
 * SheetClip - Spreadsheet Clipboard Parser
 * version 0.2
 *
 * This tiny library transforms JavaScript arrays to strings that are pasteable by LibreOffice, OpenOffice,
 * Google Docs and Microsoft Excel.
 *
 * Copyright 2012, Marcin Warpechowski
 * Licensed under the MIT license.
 * http://github.com/warpech/sheetclip/
 */
/*jslint white: true*/
(function (global) {
  "use strict";

  function countQuotes(str) {
    return str.split('"').length - 1;
  }

  global.SheetClip = {
    parse: function (str) {
      var r, rlen, rows, arr = [], a = 0, c, clen, multiline, last;
      rows = str.split('\n');
      if (rows.length > 1 && rows[rows.length - 1] === '') {
        rows.pop();
      }
      for (r = 0, rlen = rows.length; r < rlen; r += 1) {
        rows[r] = rows[r].split('\t');
        for (c = 0, clen = rows[r].length; c < clen; c += 1) {
          if (!arr[a]) {
            arr[a] = [];
          }
          if (multiline && c === 0) {
            last = arr[a].length - 1;
            arr[a][last] = arr[a][last] + '\n' + rows[r][0];
            if (multiline && (countQuotes(rows[r][0]) & 1)) { //& 1 is a bitwise way of performing mod 2
              multiline = false;
              arr[a][last] = arr[a][last].substring(0, arr[a][last].length - 1).replace(/""/g, '"');
            }
          }
          else {
            if (c === clen - 1 && rows[r][c].indexOf('"') === 0) {
              arr[a].push(rows[r][c].substring(1).replace(/""/g, '"'));
              multiline = true;
            }
            else {
              arr[a].push(rows[r][c].replace(/""/g, '"'));
              multiline = false;
            }
          }
        }
        if (!multiline) {
          a += 1;
        }
      }
      return arr;
    },

    stringify: function (arr) {
      var r, rlen, c, clen, str = '', val;
      for (r = 0, rlen = arr.length; r < rlen; r += 1) {
        for (c = 0, clen = arr[r].length; c < clen; c += 1) {
          if (c > 0) {
            str += '\t';
          }
          val = arr[r][c];
          if (typeof val === 'string') {
            if (val.indexOf('\n') > -1) {
              str += '"' + val.replace(/"/g, '""') + '"';
            }
            else {
              str += val;
            }
          }
          else if (val === null || val === void 0) { //void 0 resolves to undefined
            str += '';
          }
          else {
            str += val;
          }
        }
        str += '\n';
      }
      return str;
    }
  };
}(window));
/**
 * CopyPaste.js
 * Creates a textarea that stays hidden on the page and gets focused when user presses CTRL while not having a form input focused
 * In future we may implement a better driver when better APIs are available
 * @constructor
 */
var CopyPaste = (function () {
  var instance;
  return {
    getInstance: function () {
      if (!instance) {
        instance = new CopyPasteClass();
      }
      return instance;
    }
  };
})();

function CopyPasteClass() {
  var that = this
    , style
    , parent;

  this.copyCallbacks = [];
  this.cutCallbacks = [];
  this.pasteCallbacks = [];

  var listenerElement = document.documentElement;
  parent = document.body;

  if (document.getElementById('CopyPasteDiv')) {
    this.elDiv = document.getElementById('CopyPasteDiv');
    this.elTextarea = this.elDiv.firstChild;
  }
  else {
    this.elDiv = document.createElement('DIV');
    this.elDiv.id = 'CopyPasteDiv';
    style = this.elDiv.style;
    style.position = 'fixed';
    style.top = 0;
    style.left = 0;
    parent.appendChild(this.elDiv);

    this.elTextarea = document.createElement('TEXTAREA');
    this.elTextarea.className = 'copyPaste';
    style = this.elTextarea.style;
    style.width = '1px';
    style.height = '1px';
    this.elDiv.appendChild(this.elTextarea);

    if (typeof style.opacity !== 'undefined') {
      style.opacity = 0;
    }
    else {
      /*@cc_on @if (@_jscript)
       if(typeof style.filter === 'string') {
       style.filter = 'alpha(opacity=0)';
       }
       @end @*/
    }
  }

  this._bindEvent(listenerElement, 'keydown', function (event) {
    var isCtrlDown = false;
    if (event.metaKey) { //mac
      isCtrlDown = true;
    }
    else if (event.ctrlKey && navigator.userAgent.indexOf('Mac') === -1) { //pc
      isCtrlDown = true;
    }

    if (isCtrlDown) {
      if (document.activeElement !== that.elTextarea && that.getSelectionText() != '') {
        return; //this is needed by fragmentSelection in Handsontable. Ignore copypaste.js behavior if fragment of cell text is selected
      }

      that.selectNodeText(that.elTextarea);
      setTimeout(function () {
        that.selectNodeText(that.elTextarea);
      }, 0);
    }

    /* 67 = c
     * 86 = v
     * 88 = x
     */
    if (isCtrlDown && (event.keyCode === 67 || event.keyCode === 86 || event.keyCode === 88)) {
      // that.selectNodeText(that.elTextarea);

      if (event.keyCode === 88) { //works in all browsers, incl. Opera < 12.12
        setTimeout(function () {
          that.triggerCut(event);
        }, 0);
      }
      else if (event.keyCode === 86) {
        setTimeout(function () {
          that.triggerPaste(event);
        }, 0);
      }
    }
  });
}

//http://jsperf.com/textara-selection
//http://stackoverflow.com/questions/1502385/how-can-i-make-this-code-work-in-ie
CopyPasteClass.prototype.selectNodeText = function (el) {
  el.select();
};

//http://stackoverflow.com/questions/5379120/get-the-highlighted-selected-text
CopyPasteClass.prototype.getSelectionText = function () {
  var text = "";
  if (window.getSelection) {
    text = window.getSelection().toString();
  } else if (document.selection && document.selection.type != "Control") {
    text = document.selection.createRange().text;
  }
  return text;
};

CopyPasteClass.prototype.copyable = function (str) {
  if (typeof str !== 'string' && str.toString === void 0) {
    throw new Error('copyable requires string parameter');
  }
  this.elTextarea.value = str;
};

CopyPasteClass.prototype.onCopy = function (fn) {
  this.copyCallbacks.push(fn);
};

CopyPasteClass.prototype.onCut = function (fn) {
  this.cutCallbacks.push(fn);
};

CopyPasteClass.prototype.onPaste = function (fn) {
  this.pasteCallbacks.push(fn);
};

CopyPasteClass.prototype.removeCallback = function (fn) {
  var i, ilen;
  for (i = 0, ilen = this.copyCallbacks.length; i < ilen; i++) {
    if (this.copyCallbacks[i] === fn) {
      this.copyCallbacks.splice(i, 1);
      return true;
    }
  }
  for (i = 0, ilen = this.cutCallbacks.length; i < ilen; i++) {
    if (this.cutCallbacks[i] === fn) {
      this.cutCallbacks.splice(i, 1);
      return true;
    }
  }
  for (i = 0, ilen = this.pasteCallbacks.length; i < ilen; i++) {
    if (this.pasteCallbacks[i] === fn) {
      this.pasteCallbacks.splice(i, 1);
      return true;
    }
  }
  return false;
};

CopyPasteClass.prototype.triggerCut = function (event) {
  var that = this;
  if (that.cutCallbacks) {
    setTimeout(function () {
      for (var i = 0, ilen = that.cutCallbacks.length; i < ilen; i++) {
        that.cutCallbacks[i](event);
      }
    }, 50);
  }
};

CopyPasteClass.prototype.triggerPaste = function (event, str) {
  var that = this;
  if (that.pasteCallbacks) {
    setTimeout(function () {
      var val = (str || that.elTextarea.value).replace(/\n$/, ''); //remove trailing newline
      for (var i = 0, ilen = that.pasteCallbacks.length; i < ilen; i++) {
        that.pasteCallbacks[i](val, event);
      }
    }, 50);
  }
};

//http://net.tutsplus.com/tutorials/javascript-ajax/javascript-from-null-cross-browser-event-binding/
//http://stackoverflow.com/questions/4643249/cross-browser-event-object-normalization
CopyPasteClass.prototype._bindEvent = (function () {
  if (document.addEventListener) {
    return function (elem, type, cb) {
      elem.addEventListener(type, cb, false);
    };
  }
  else {
    return function (elem, type, cb) {
      elem.attachEvent('on' + type, function () {
        var e = window['event'];
        e.target = e.srcElement;
        e.relatedTarget = e.relatedTarget || e.type == 'mouseover' ? e.fromElement : e.toElement;
        if (e.target.nodeType === 3) e.target = e.target.parentNode; //Safari bug
        return cb.call(elem, e)
      });
    };
  }
})();
function WalkontableBorder(instance, settings) {
  var style;

  //reference to instance
  this.instance = instance;
  this.settings = settings;
  this.wtDom = this.instance.wtDom;

  this.main = document.createElement("div");
  style = this.main.style;
  style.position = 'absolute';
  style.top = 0;
  style.left = 0;
//  style.visibility = 'hidden';

  for (var i = 0; i < 5; i++) {
    var DIV = document.createElement('DIV');
    DIV.className = 'wtBorder ' + (settings.className || '');
    style = DIV.style;
    style.backgroundColor = settings.border.color;
    style.height = settings.border.width + 'px';
    style.width = settings.border.width + 'px';
    this.main.appendChild(DIV);
  }

  this.top = this.main.childNodes[0];
  this.left = this.main.childNodes[1];
  this.bottom = this.main.childNodes[2];
  this.right = this.main.childNodes[3];


  /*$(this.top).on(sss, function(event) {
   event.preventDefault();
   event.stopImmediatePropagation();
   $(this).hide();
   });
   $(this.left).on(sss, function(event) {
   event.preventDefault();
   event.stopImmediatePropagation();
   $(this).hide();
   });
   $(this.bottom).on(sss, function(event) {
   event.preventDefault();
   event.stopImmediatePropagation();
   $(this).hide();
   });
   $(this.right).on(sss, function(event) {
   event.preventDefault();
   event.stopImmediatePropagation();
   $(this).hide();
   });*/

  this.topStyle = this.top.style;
  this.leftStyle = this.left.style;
  this.bottomStyle = this.bottom.style;
  this.rightStyle = this.right.style;

  this.corner = this.main.childNodes[4];
  this.corner.className += ' corner';
  this.cornerStyle = this.corner.style;
  this.cornerStyle.width = '5px';
  this.cornerStyle.height = '5px';
  this.cornerStyle.border = '2px solid #FFF';

  this.disappear();
  if (!instance.wtTable.bordersHolder) {
    instance.wtTable.bordersHolder = document.createElement('div');
    instance.wtTable.bordersHolder.className = 'htBorders';
    instance.wtTable.hider.appendChild(instance.wtTable.bordersHolder);

  }
  instance.wtTable.bordersHolder.appendChild(this.main);

  var down = false;
  var $body = $(document.body);

  $body.on('mousedown.walkontable.' + instance.guid, function () {
    down = true;
  });

  $body.on('mouseup.walkontable.' + instance.guid, function () {
    down = false
  });

  $(this.main.childNodes).on('mouseenter', function (event) {
    if (!down || !instance.getSetting('hideBorderOnMouseDownOver')) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    var bounds = this.getBoundingClientRect();

    var $this = $(this);
    $this.hide();

    var isOutside = function (event) {
      if (event.clientY < Math.floor(bounds.top)) {
        return true;
      }
      if (event.clientY > Math.ceil(bounds.top + bounds.height)) {
        return true;
      }
      if (event.clientX < Math.floor(bounds.left)) {
        return true;
      }
      if (event.clientX > Math.ceil(bounds.left + bounds.width)) {
        return true;
      }
    };

    $body.on('mousemove.border.' + instance.guid, function (event) {
      if (isOutside(event)) {
        $body.off('mousemove.border.' + instance.guid);
        $this.show();
      }
    });
  });
}

/**
 * Show border around one or many cells
 * @param {Array} corners
 */
WalkontableBorder.prototype.appear = function (corners) {
  var isMultiple, fromTD, toTD, fromOffset, toOffset, containerOffset, top, minTop, left, minLeft, height, width;
  if (this.disabled) {
    return;
  }

  var instance = this.instance
    , fromRow
    , fromColumn
    , toRow
    , toColumn
    , hideTop = false
    , hideLeft = false
    , hideBottom = false
    , hideRight = false
    , i
    , ilen
    , s;

  if (!instance.wtTable.isRowInViewport(corners[0])) {
    hideTop = true;
  }

  if (!instance.wtTable.isRowInViewport(corners[2])) {
    hideBottom = true;
  }

  ilen = instance.wtTable.rowStrategy.countVisible();

  for (i = 0; i < ilen; i++) {
    s = instance.wtTable.rowFilter.visibleToSource(i);
    if (s >= corners[0] && s <= corners[2]) {
      fromRow = s;
      break;
    }
  }

  for (i = ilen - 1; i >= 0; i--) {
    s = instance.wtTable.rowFilter.visibleToSource(i);
    if (s >= corners[0] && s <= corners[2]) {
      toRow = s;
      break;
    }
  }

  if (hideTop && hideBottom) {
    hideLeft = true;
    hideRight = true;
  }
  else {
    if (!instance.wtTable.isColumnInViewport(corners[1])) {
      hideLeft = true;
    }

    if (!instance.wtTable.isColumnInViewport(corners[3])) {
      hideRight = true;
    }

    ilen = instance.wtTable.columnStrategy.countVisible();

    for (i = 0; i < ilen; i++) {
      s = instance.wtTable.columnFilter.visibleToSource(i);
      if (s >= corners[1] && s <= corners[3]) {
        fromColumn = s;
        break;
      }
    }

    for (i = ilen - 1; i >= 0; i--) {
      s = instance.wtTable.columnFilter.visibleToSource(i);
      if (s >= corners[1] && s <= corners[3]) {
        toColumn = s;
        break;
      }
    }
  }

  if (fromRow !== void 0 && fromColumn !== void 0) {
    isMultiple = (fromRow !== toRow || fromColumn !== toColumn);
    fromTD = instance.wtTable.getCell([fromRow, fromColumn]);
    toTD = isMultiple ? instance.wtTable.getCell([toRow, toColumn]) : fromTD;
    fromOffset = this.wtDom.offset(fromTD);
    toOffset = isMultiple ? this.wtDom.offset(toTD) : fromOffset;
    containerOffset = this.wtDom.offset(instance.wtTable.TABLE);

    minTop = fromOffset.top;
    height = toOffset.top + this.wtDom.outerHeight(toTD) - minTop;
    minLeft = fromOffset.left;
    width = toOffset.left + this.wtDom.outerWidth(toTD) - minLeft;

    top = minTop - containerOffset.top - 1;
    left = minLeft - containerOffset.left - 1;

    var style = this.wtDom.getComputedStyle(fromTD);
    if (parseInt(style['borderTopWidth'], 10) > 0) {
      top += 1;
      height -= 1;
    }
    if (parseInt(style['borderLeftWidth'], 10) > 0) {
      left += 1;
      width -= 1;
    }
  }
  else {
    this.disappear();
    return;
  }

  if (hideTop) {
    this.topStyle.display = 'none';
  }
  else {
    this.topStyle.top = top + 'px';
    this.topStyle.left = left + 'px';
    this.topStyle.width = width + 'px';
    this.topStyle.display = 'block';
  }

  if (hideLeft) {
    this.leftStyle.display = 'none';
  }
  else {
    this.leftStyle.top = top + 'px';
    this.leftStyle.left = left + 'px';
    this.leftStyle.height = height + 'px';
    this.leftStyle.display = 'block';
  }

  var delta = Math.floor(this.settings.border.width / 2);

  if (hideBottom) {
    this.bottomStyle.display = 'none';
  }
  else {
    this.bottomStyle.top = top + height - delta + 'px';
    this.bottomStyle.left = left + 'px';
    this.bottomStyle.width = width + 'px';
    this.bottomStyle.display = 'block';
  }

  if (hideRight) {
    this.rightStyle.display = 'none';
  }
  else {
    this.rightStyle.top = top + 'px';
    this.rightStyle.left = left + width - delta + 'px';
    this.rightStyle.height = height + 1 + 'px';
    this.rightStyle.display = 'block';
  }

  if (hideBottom || hideRight || !this.hasSetting(this.settings.border.cornerVisible)) {
    this.cornerStyle.display = 'none';
  }
  else {
    this.cornerStyle.top = top + height - 4 + 'px';
    this.cornerStyle.left = left + width - 4 + 'px';
    this.cornerStyle.display = 'block';
  }
};

/**
 * Hide border
 */
WalkontableBorder.prototype.disappear = function () {
  this.topStyle.display = 'none';
  this.leftStyle.display = 'none';
  this.bottomStyle.display = 'none';
  this.rightStyle.display = 'none';
  this.cornerStyle.display = 'none';
};

WalkontableBorder.prototype.hasSetting = function (setting) {
  if (typeof setting === 'function') {
    return setting();
  }
  return !!setting;
};
/**
 * WalkontableCellFilter
 * @constructor
 */
function WalkontableCellFilter() {
  this.offset = 0;
  this.total = 0;
  this.fixedCount = 0;
}

WalkontableCellFilter.prototype.source = function (n) {
  return n;
};

WalkontableCellFilter.prototype.offsetted = function (n) {
  return n + this.offset;
};

WalkontableCellFilter.prototype.unOffsetted = function (n) {
  return n - this.offset;
};

WalkontableCellFilter.prototype.fixed = function (n) {
  if (n < this.fixedCount) {
    return n - this.offset;
  }
  else {
    return n;
  }
};

WalkontableCellFilter.prototype.unFixed = function (n) {
  if (n < this.fixedCount) {
    return n + this.offset;
  }
  else {
    return n;
  }
};

WalkontableCellFilter.prototype.visibleToSource = function (n) {
  return this.source(this.offsetted(this.fixed(n)));
};

WalkontableCellFilter.prototype.sourceToVisible = function (n) {
  return this.source(this.unOffsetted(this.unFixed(n)));
};
/**
 * WalkontableCellStrategy
 * @constructor
 */
function WalkontableCellStrategy() {
}

WalkontableCellStrategy.prototype.getSize = function (index) {
  return this.cellSizes[index];
};

WalkontableCellStrategy.prototype.getContainerSize = function (proposedSize) {
  return typeof this.containerSizeFn === 'function' ? this.containerSizeFn(proposedSize) : this.containerSizeFn;
};

WalkontableCellStrategy.prototype.countVisible = function () {
  return this.cellCount;
};

WalkontableCellStrategy.prototype.isLastIncomplete = function () {
  return this.remainingSize > 0;
};
/**
 * WalkontableClassNameList
 * @constructor
 */
function WalkontableClassNameCache() {
  this.cache = [];
}

WalkontableClassNameCache.prototype.add = function (r, c, cls) {
  if (!this.cache[r]) {
    this.cache[r] = [];
  }
  if (!this.cache[r][c]) {
    this.cache[r][c] = [];
  }
  this.cache[r][c][cls] = true;
};

WalkontableClassNameCache.prototype.test = function (r, c, cls) {
  return (this.cache[r] && this.cache[r][c] && this.cache[r][c][cls]);
};
/**
 * WalkontableColumnFilter
 * @constructor
 */
function WalkontableColumnFilter() {
  this.countTH = 0;
}

WalkontableColumnFilter.prototype = new WalkontableCellFilter();

WalkontableColumnFilter.prototype.readSettings = function (instance) {
  this.offset = instance.wtSettings.settings.offsetColumn;
  this.total = instance.getSetting('totalColumns');
  this.fixedCount = instance.getSetting('fixedColumnsLeft');
  this.countTH = instance.getSetting('rowHeaders').length;
};

WalkontableColumnFilter.prototype.offsettedTH = function (n) {
  return n - this.countTH;
};

WalkontableColumnFilter.prototype.unOffsettedTH = function (n) {
  return n + this.countTH;
};

WalkontableColumnFilter.prototype.visibleRowHeadedColumnToSourceColumn = function (n) {
  return this.visibleToSource(this.offsettedTH(n));
};

WalkontableColumnFilter.prototype.sourceColumnToVisibleRowHeadedColumn = function (n) {
  return this.unOffsettedTH(this.sourceToVisible(n));
};
/**
 * WalkontableColumnStrategy
 * @param containerSizeFn
 * @param sizeAtIndex
 * @param strategy - all, last, none
 * @constructor
 */
function WalkontableColumnStrategy(containerSizeFn, sizeAtIndex, strategy) {
  var size
    , i = 0;

  this.containerSizeFn = containerSizeFn;
  this.cellSizesSum = 0;
  this.cellSizes = [];
  this.cellStretch = [];
  this.cellCount = 0;
  this.remainingSize = 0;
  this.strategy = strategy;

  //step 1 - determine cells that fit containerSize and cache their widths
  while (true) {
    size = sizeAtIndex(i);
    if (size === void 0) {
      break; //total columns exceeded
    }
    if (this.cellSizesSum >= this.getContainerSize(this.cellSizesSum + size)) {
      break; //total width exceeded
    }
    this.cellSizes.push(size);
    this.cellSizesSum += size;
    this.cellCount++;

    i++;
  }

  var containerSize = this.getContainerSize(this.cellSizesSum);
  this.remainingSize = this.cellSizesSum - containerSize;
  //negative value means the last cell is fully visible and there is some space left for stretching
  //positive value means the last cell is not fully visible
}

WalkontableColumnStrategy.prototype = new WalkontableCellStrategy();

WalkontableColumnStrategy.prototype.getSize = function (index) {
  return this.cellSizes[index] + (this.cellStretch[index] || 0);
};

WalkontableColumnStrategy.prototype.stretch = function () {
  //step 2 - apply stretching strategy
  var containerSize = this.getContainerSize(this.cellSizesSum)
    , i = 0;
  this.remainingSize = this.cellSizesSum - containerSize;

  this.cellStretch.length = 0; //clear previous stretch

  if (this.strategy === 'all') {
    if (this.remainingSize < 0) {
      var ratio = containerSize / this.cellSizesSum;
      var newSize;

      while (i < this.cellCount - 1) { //"i < this.cellCount - 1" is needed because last cellSize is adjusted after the loop
        newSize = Math.floor(ratio * this.cellSizes[i]);
        this.remainingSize += newSize - this.cellSizes[i];
        this.cellStretch[i] = newSize - this.cellSizes[i];
        i++;
      }
      this.cellStretch[this.cellCount - 1] = -this.remainingSize;
      this.remainingSize = 0;
    }
  }
  else if (this.strategy === 'last') {
    if (this.remainingSize < 0) {
      this.cellStretch[this.cellCount - 1] = -this.remainingSize;
      this.remainingSize = 0;
    }
  }
};
function Walkontable(settings) {
  var that = this,
    originalHeaders = [];

  this.guid = 'wt_' + (window.Handsontable ? Handsontable.helper.randomString() : ''); //this is the namespace for global events

  //bootstrap from settings
  this.wtSettings = new WalkontableSettings(this, settings);
  this.wtDom = new WalkontableDom();
  this.wtTable = new WalkontableTable(this);
  this.wtScroll = new WalkontableScroll(this);
  this.wtScrollbars = new WalkontableScrollbars(this);
  this.wtViewport = new WalkontableViewport(this);
  this.wtWheel = new WalkontableWheel(this);
  this.wtEvent = new WalkontableEvent(this);

  //find original headers
  if (this.wtTable.THEAD.childNodes.length && this.wtTable.THEAD.childNodes[0].childNodes.length) {
    for (var c = 0, clen = this.wtTable.THEAD.childNodes[0].childNodes.length; c < clen; c++) {
      originalHeaders.push(this.wtTable.THEAD.childNodes[0].childNodes[c].innerHTML);
    }
    if (!this.getSetting('columnHeaders').length) {
      this.update('columnHeaders', [function (column, TH) {
        that.wtDom.fastInnerText(TH, originalHeaders[column]);
      }]);
    }
  }

  //initialize selections
  this.selections = {};
  var selectionsSettings = this.getSetting('selections');
  if (selectionsSettings) {
    for (var i in selectionsSettings) {
      if (selectionsSettings.hasOwnProperty(i)) {
        this.selections[i] = new WalkontableSelection(this, selectionsSettings[i]);
      }
    }
  }

  this.drawn = false;
  this.drawInterrupted = false;
}

Walkontable.prototype.draw = function (selectionsOnly) {
  this.drawInterrupted = false;
  if (!selectionsOnly && !this.wtDom.isVisible(this.wtTable.TABLE)) {
    this.drawInterrupted = true; //draw interrupted because TABLE is not visible
    return;
  }

  this.getSetting('beforeDraw', !selectionsOnly);
  selectionsOnly = selectionsOnly && this.getSetting('offsetRow') === this.lastOffsetRow && this.getSetting('offsetColumn') === this.lastOffsetColumn;
  if (this.drawn) { //fix offsets that might have changed
    this.scrollVertical(0);
    this.scrollHorizontal(0);
  }
  this.lastOffsetRow = this.getSetting('offsetRow');
  this.lastOffsetColumn = this.getSetting('offsetColumn');
  this.wtTable.draw(selectionsOnly);
  this.getSetting('onDraw');
  return this;
};

Walkontable.prototype.update = function (settings, value) {
  return this.wtSettings.update(settings, value);
};

Walkontable.prototype.scrollVertical = function (delta) {
  return this.wtScroll.scrollVertical(delta);
};

Walkontable.prototype.scrollHorizontal = function (delta) {
  return this.wtScroll.scrollHorizontal(delta);
};

Walkontable.prototype.scrollViewport = function (coords) {
  this.wtScroll.scrollViewport(coords);
  return this;
};

Walkontable.prototype.getViewport = function () {
  return [
    this.wtTable.rowFilter.visibleToSource(0),
    this.wtTable.columnFilter.visibleToSource(0),
    this.wtTable.getLastVisibleRow(),
    this.wtTable.getLastVisibleColumn()
  ];
};

Walkontable.prototype.getSetting = function (key, param1, param2, param3) {
  return this.wtSettings.getSetting(key, param1, param2, param3);
};

Walkontable.prototype.hasSetting = function (key) {
  return this.wtSettings.has(key);
};

Walkontable.prototype.destroy = function () {
  $(document.body).off('.' + this.guid);
  this.wtScrollbars.destroy();
  clearTimeout(this.wheelTimeout);
  clearTimeout(this.dblClickTimeout);
};
function WalkontableDom() {
}

//goes up the DOM tree (including given element) until it finds an element that matches the nodeName
WalkontableDom.prototype.closest = function (elem, nodeNames, until) {
  while (elem != null && elem !== until) {
    if (elem.nodeType === 1 && nodeNames.indexOf(elem.nodeName) > -1) {
      return elem;
    }
    elem = elem.parentNode;
  }
  return null;
};

//goes up the DOM tree and checks if element is child of another element
WalkontableDom.prototype.isChildOf = function (child, parent) {
  var node = child.parentNode;
  while (node != null) {
    if (node == parent) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

WalkontableDom.prototype.prevSiblings = function (elem) {
  var out = [];
  while ((elem = elem.previousSibling) != null) {
    if (elem.nodeType === 1) {
      out.push(elem);
    }
  }
  return out;
};

if (document.documentElement.classList) {
  // HTML5 classList API
  WalkontableDom.prototype.hasClass = function (ele, cls) {
    return ele.classList.contains(cls);
  };

  WalkontableDom.prototype.addClass = function (ele, cls) {
    ele.classList.add(cls);
  };

  WalkontableDom.prototype.removeClass = function (ele, cls) {
    ele.classList.remove(cls);
  };
}
else {
  //http://snipplr.com/view/3561/addclass-removeclass-hasclass/
  WalkontableDom.prototype.hasClass = function (ele, cls) {
    return ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
  };

  WalkontableDom.prototype.addClass = function (ele, cls) {
    if (!this.hasClass(ele, cls)) ele.className += " " + cls;
  };

  WalkontableDom.prototype.removeClass = function (ele, cls) {
    if (this.hasClass(ele, cls)) { //is this really needed?
      var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
      ele.className = ele.className.replace(reg, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, ''); //last 2 replaces do right trim (see http://blog.stevenlevithan.com/archives/faster-trim-javascript)
    }
  };
}

/*//http://net.tutsplus.com/tutorials/javascript-ajax/javascript-from-null-cross-browser-event-binding/
 WalkontableDom.prototype.addEvent = (function () {
 var that = this;
 if (document.addEventListener) {
 return function (elem, type, cb) {
 if ((elem && !elem.length) || elem === window) {
 elem.addEventListener(type, cb, false);
 }
 else if (elem && elem.length) {
 var len = elem.length;
 for (var i = 0; i < len; i++) {
 that.addEvent(elem[i], type, cb);
 }
 }
 };
 }
 else {
 return function (elem, type, cb) {
 if ((elem && !elem.length) || elem === window) {
 elem.attachEvent('on' + type, function () {

 //normalize
 //http://stackoverflow.com/questions/4643249/cross-browser-event-object-normalization
 var e = window['event'];
 e.target = e.srcElement;
 //e.offsetX = e.layerX;
 //e.offsetY = e.layerY;
 e.relatedTarget = e.relatedTarget || e.type == 'mouseover' ? e.fromElement : e.toElement;
 if (e.target.nodeType === 3) e.target = e.target.parentNode; //Safari bug

 return cb.call(elem, e)
 });
 }
 else if (elem.length) {
 var len = elem.length;
 for (var i = 0; i < len; i++) {
 that.addEvent(elem[i], type, cb);
 }
 }
 };
 }
 })();

 WalkontableDom.prototype.triggerEvent = function (element, eventName, target) {
 var event;
 if (document.createEvent) {
 event = document.createEvent("MouseEvents");
 event.initEvent(eventName, true, true);
 } else {
 event = document.createEventObject();
 event.eventType = eventName;
 }

 event.eventName = eventName;
 event.target = target;

 if (document.createEvent) {
 target.dispatchEvent(event);
 } else {
 target.fireEvent("on" + event.eventType, event);
 }
 };*/

WalkontableDom.prototype.removeTextNodes = function (elem, parent) {
  if (elem.nodeType === 3) {
    parent.removeChild(elem); //bye text nodes!
  }
  else if (['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR'].indexOf(elem.nodeName) > -1) {
    var childs = elem.childNodes;
    for (var i = childs.length - 1; i >= 0; i--) {
      this.removeTextNodes(childs[i], elem);
    }
  }
};

/**
 * Remove childs function
 * WARNING - this doesn't unload events and data attached by jQuery
 * http://jsperf.com/jquery-html-vs-empty-vs-innerhtml/9
 * @param element
 * @returns {void}
 */
//
WalkontableDom.prototype.empty = function (element) {
  var child;
  while (child = element.lastChild) {
    element.removeChild(child);
  }
};

WalkontableDom.prototype.HTML_CHARACTERS = /(<(.*)>|&(.*);)/;

/**
 * Insert content into element trying avoid innerHTML method.
 * @return {void}
 */
WalkontableDom.prototype.fastInnerHTML = function (element, content) {
  if (this.HTML_CHARACTERS.test(content)) {
    element.innerHTML = content;
  }
  else {
    this.fastInnerText(element, content);
  }
};

/**
 * Insert text content into element
 * @return {void}
 */
if (document.createTextNode('test').textContent) { //STANDARDS
  WalkontableDom.prototype.fastInnerText = function (element, content) {
    var child = element.firstChild;
    if (child && child.nodeType === 3 && child.nextSibling === null) {
      //fast lane - replace existing text node
      //http://jsperf.com/replace-text-vs-reuse
      child.textContent = content;
    }
    else {
      //slow lane - empty element and insert a text node
      this.empty(element);
      element.appendChild(document.createTextNode(content));
    }
  };
}
else { //IE8
  WalkontableDom.prototype.fastInnerText = function (element, content) {
    var child = element.firstChild;
    if (child && child.nodeType === 3 && child.nextSibling === null) {
      //fast lane - replace existing text node
      //http://jsperf.com/replace-text-vs-reuse
      child.data = content;
    }
    else {
      //slow lane - empty element and insert a text node
      this.empty(element);
      element.appendChild(document.createTextNode(content));
    }
  };
}

/**
 * Returns true if element is attached to the DOM and visible, false otherwise
 * @param elem
 * @returns {boolean}
 */
WalkontableDom.prototype.isVisible = function (elem) {
  //fast method
  try {//try/catch performance is not a problem here: http://jsperf.com/try-catch-performance-overhead/7
    if (!elem.offsetParent) {
      return false; //fixes problem with UI Bootstrap <tabs> directive
    }
  }
  catch (e) {
    return false; //IE8 throws "Unspecified error" when offsetParent is not found - we catch it here
  }

//  if (elem.offsetWidth > 0 || (elem.parentNode && elem.parentNode.offsetWidth > 0)) { //IE10 was mistaken here
  if (elem.offsetWidth > 0) {
    return true;
  }

  //slow method
  var next = elem;
  while (next !== document.documentElement) { //until <html> reached
    if (next === null) { //parent detached from DOM
      return false;
    }
    else if (next.nodeType === 11) {
      return true;
    }
    else if (next.style.display === 'none') {
      return false;
    }
    next = next.parentNode;
  }
  return true;
};

/**
 * Returns elements top and left offset relative to the document. In our usage case compatible with jQuery but 2x faster
 * @param {HTMLElement} elem
 * @return {Object}
 */
WalkontableDom.prototype.offset = function (elem) {
  var offsetLeft = elem.offsetLeft
    , offsetTop = elem.offsetTop
    , lastElem = elem;

  while (elem = elem.offsetParent) {
    if (elem === document.body) { //from my observation, document.body always has scrollLeft/scrollTop == 0
      break;
    }
    offsetLeft += elem.offsetLeft;
    offsetTop += elem.offsetTop;
    lastElem = elem;
  }

  if (lastElem && lastElem.style.position === 'fixed') { //slow - http://jsperf.com/offset-vs-getboundingclientrect/6
    //if(lastElem !== document.body) { //faster but does gives false positive in Firefox
    offsetLeft += window.pageXOffset || document.documentElement.scrollLeft;
    offsetTop += window.pageYOffset || document.documentElement.scrollTop;
  }

  return {
    left: offsetLeft,
    top: offsetTop
  };
};

WalkontableDom.prototype.getComputedStyle = function (elem) {
  return elem.currentStyle || document.defaultView.getComputedStyle(elem);
};

WalkontableDom.prototype.outerWidth = function (elem) {
  return elem.offsetWidth;
};

WalkontableDom.prototype.outerHeight = function (elem) {
  if (this.hasCaptionProblem() && elem.firstChild && elem.firstChild.nodeName === 'CAPTION') {
    //fixes problem with Firefox ignoring <caption> in TABLE.offsetHeight
    //jQuery (1.10.1) still has this unsolved
    //may be better to just switch to getBoundingClientRect
    //http://bililite.com/blog/2009/03/27/finding-the-size-of-a-table/
    //http://lists.w3.org/Archives/Public/www-style/2009Oct/0089.html
    //http://bugs.jquery.com/ticket/2196
    //http://lists.w3.org/Archives/Public/www-style/2009Oct/0140.html#start140
    return elem.offsetHeight + elem.firstChild.offsetHeight;
  }
  else {
    return elem.offsetHeight;
  }
};

(function () {
  var hasCaptionProblem;

  function detectCaptionProblem() {
    var TABLE = document.createElement('TABLE');
    TABLE.style.borderSpacing = 0;
    TABLE.style.borderWidth = 0;
    TABLE.style.padding = 0;
    var TBODY = document.createElement('TBODY');
    TABLE.appendChild(TBODY);
    TBODY.appendChild(document.createElement('TR'));
    TBODY.firstChild.appendChild(document.createElement('TD'));
    TBODY.firstChild.firstChild.innerHTML = '<tr><td>t<br>t</td></tr>';

    var CAPTION = document.createElement('CAPTION');
    CAPTION.innerHTML = 'c<br>c<br>c<br>c';
    CAPTION.style.padding = 0;
    CAPTION.style.margin = 0;
    TABLE.insertBefore(CAPTION, TBODY);

    document.body.appendChild(TABLE);
    hasCaptionProblem = (TABLE.offsetHeight < 2 * TABLE.lastChild.offsetHeight); //boolean
    document.body.removeChild(TABLE);
  }

  WalkontableDom.prototype.hasCaptionProblem = function () {
    if (hasCaptionProblem === void 0) {
      detectCaptionProblem();
    }
    return hasCaptionProblem;
  };
})();

function WalkontableEvent(instance) {
  var that = this;

  //reference to instance
  this.instance = instance;

  this.wtDom = this.instance.wtDom;

  var dblClickOrigin = [null, null, null, null];
  this.instance.dblClickTimeout = null;

  var onMouseDown = function (event) {
    var cell = that.parentCell(event.target);

    if (cell.TD && cell.TD.nodeName === 'TD') {
      if (that.instance.hasSetting('onCellMouseDown')) {
        that.instance.getSetting('onCellMouseDown', event, cell.coords, cell.TD);
      }
    }
    else if (that.wtDom.hasClass(event.target, 'corner')) {
      that.instance.getSetting('onCellCornerMouseDown', event, event.target);
    }

    if (event.button !== 2) { //if not right mouse button
      if (cell.TD && cell.TD.nodeName === 'TD') {
        dblClickOrigin.shift();
        dblClickOrigin.push(cell.TD);
      }
      else if (that.wtDom.hasClass(event.target, 'corner')) {
        dblClickOrigin.shift();
        dblClickOrigin.push(event.target);
      }
    }
  };

  var lastMouseOver;
  var onMouseOver = function (event) {
    if (that.instance.hasSetting('onCellMouseOver')) {
      var TABLE = that.instance.wtTable.TABLE;
      var TD = that.wtDom.closest(event.target, ['TD', 'TH'], TABLE);
      if (TD && TD !== lastMouseOver && that.wtDom.isChildOf(TD, TABLE)) {
        lastMouseOver = TD;
        if (TD.nodeName === 'TD') {
          that.instance.getSetting('onCellMouseOver', event, that.instance.wtTable.getCoords(TD), TD);
        }
      }
    }
  };

/*  var lastMouseOut;
  var onMouseOut = function (event) {
    if (that.instance.hasSetting('onCellMouseOut')) {
      var TABLE = that.instance.wtTable.TABLE;
      var TD = that.wtDom.closest(event.target, ['TD', 'TH'], TABLE);
      if (TD && TD !== lastMouseOut && that.wtDom.isChildOf(TD, TABLE)) {
        lastMouseOut = TD;
        if (TD.nodeName === 'TD') {
          that.instance.getSetting('onCellMouseOut', event, that.instance.wtTable.getCoords(TD), TD);
        }
      }
    }
  };*/

  var onMouseUp = function (event) {
    if (event.button !== 2) { //if not right mouse button
      var cell = that.parentCell(event.target);

      if (cell.TD && cell.TD.nodeName === 'TD') {
        dblClickOrigin.shift();
        dblClickOrigin.push(cell.TD);
      }
      else {
        dblClickOrigin.shift();
        dblClickOrigin.push(event.target);
      }

      if (dblClickOrigin[3] !== null && dblClickOrigin[3] === dblClickOrigin[2]) {
        if (that.instance.dblClickTimeout && dblClickOrigin[2] === dblClickOrigin[1] && dblClickOrigin[1] === dblClickOrigin[0]) {
          if (cell.TD) {
            that.instance.getSetting('onCellDblClick', event, cell.coords, cell.TD);
          }
          else if (that.wtDom.hasClass(event.target, 'corner')) {
            that.instance.getSetting('onCellCornerDblClick', event, cell.coords, cell.TD);
          }

          clearTimeout(that.instance.dblClickTimeout);
          that.instance.dblClickTimeout = null;
        }
        else {
          clearTimeout(that.instance.dblClickTimeout);
          that.instance.dblClickTimeout = setTimeout(function () {
            that.instance.dblClickTimeout = null;
          }, 500);
        }
      }
    }
  };

  $(this.instance.wtTable.parent).on('mousedown', onMouseDown);
  $(this.instance.wtTable.TABLE).on('mouseover', onMouseOver);
//  $(this.instance.wtTable.TABLE).on('mouseout', onMouseOut);
  $(this.instance.wtTable.parent).on('mouseup', onMouseUp);
}

WalkontableEvent.prototype.parentCell = function (elem) {
  var cell = {};
  var TABLE = this.instance.wtTable.TABLE;
  var TD = this.wtDom.closest(elem, ['TD', 'TH'], TABLE);
  if (TD && this.wtDom.isChildOf(TD, TABLE)) {
    cell.coords = this.instance.wtTable.getCoords(TD);
    cell.TD = TD;
  }
  else if (this.wtDom.hasClass(elem, 'wtBorder') && this.wtDom.hasClass(elem, 'current') && !this.wtDom.hasClass(elem, 'corner')) {
    cell.coords = this.instance.selections.current.selected[0];
    cell.TD = this.instance.wtTable.getCell(cell.coords);
  }
  return cell;
};
function walkontableRangesIntersect() {
  var from = arguments[0];
  var to = arguments[1];
  for (var i = 1, ilen = arguments.length / 2; i < ilen; i++) {
    if (from <= arguments[2 * i + 1] && to >= arguments[2 * i]) {
      return true;
    }
  }
  return false;
}
//http://stackoverflow.com/questions/3629183/why-doesnt-indexof-work-on-an-array-ie8
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (elt /*, from*/) {
    var len = this.length >>> 0;

    var from = Number(arguments[1]) || 0;
    from = (from < 0)
      ? Math.ceil(from)
      : Math.floor(from);
    if (from < 0)
      from += len;

    for (; from < len; from++) {
      if (from in this &&
        this[from] === elt)
        return from;
    }
    return -1;
  };
}

/**
 * http://notes.jetienne.com/2011/05/18/cancelRequestAnimFrame-for-paul-irish-requestAnimFrame.html
 */
window.requestAnimFrame = (function () {
  return  window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (/* function */ callback, /* DOMElement */ element) {
      return window.setTimeout(callback, 1000 / 60);
    };
})();

window.cancelRequestAnimFrame = (function () {
  return window.cancelAnimationFrame ||
    window.webkitCancelRequestAnimationFrame ||
    window.mozCancelRequestAnimationFrame ||
    window.oCancelRequestAnimationFrame ||
    window.msCancelRequestAnimationFrame ||
    clearTimeout
})();

//http://snipplr.com/view/13523/
//modified for speed
//http://jsperf.com/getcomputedstyle-vs-style-vs-css/8
if (!window.getComputedStyle) {
  (function () {
    var elem;

    var styleObj = {
      getPropertyValue: function getPropertyValue(prop) {
        if (prop == 'float') prop = 'styleFloat';
        return elem.currentStyle[prop.toUpperCase()] || null;
      }
    }

    window.getComputedStyle = function (el) {
      elem = el;
      return styleObj;
    }
  })();
}
/**
 * WalkontableRowFilter
 * @constructor
 */
function WalkontableRowFilter() {
}

WalkontableRowFilter.prototype = new WalkontableCellFilter();

WalkontableRowFilter.prototype.readSettings = function (instance) {
  this.offset = instance.wtSettings.settings.offsetRow;
  this.total = instance.getSetting('totalRows');
  this.fixedCount = instance.getSetting('fixedRowsTop');
};
/**
 * WalkontableRowStrategy
 * @param containerSizeFn
 * @param sizeAtIndex
 * @constructor
 */
function WalkontableRowStrategy(containerSizeFn, sizeAtIndex) {
  this.containerSizeFn = containerSizeFn;
  this.sizeAtIndex = sizeAtIndex;
  this.cellSizesSum = 0;
  this.cellSizes = [];
  this.cellCount = 0;
  this.remainingSize = -Infinity;
}

WalkontableRowStrategy.prototype = new WalkontableCellStrategy();

WalkontableRowStrategy.prototype.add = function (i, TD) {
  if (this.remainingSize < 0) {
    var size = this.sizeAtIndex(i, TD);
    if (size === void 0) {
      return; //total rows exceeded
    }
    var containerSize = this.getContainerSize(this.cellSizesSum + size);
    this.cellSizes.push(size);
    this.cellSizesSum += size;
    this.cellCount++;
    this.remainingSize = this.cellSizesSum - containerSize;
  }
};

WalkontableRowStrategy.prototype.remove = function () {
  var size = this.cellSizes.pop();
  this.cellSizesSum -= size;
  this.cellCount--;
  this.remainingSize += size;
};
function WalkontableScroll(instance) {
  this.instance = instance;
}

WalkontableScroll.prototype.scrollVertical = function (delta) {
  if (!this.instance.drawn) {
    throw new Error('scrollVertical can only be called after table was drawn to DOM');
  }

  var instance = this.instance
    , newOffset
    , offset = instance.getSetting('offsetRow')
    , fixedCount = instance.getSetting('fixedRowsTop')
    , total = instance.getSetting('totalRows')
    , maxSize = instance.wtViewport.getViewportHeight();

  if (total > 0) {
    newOffset = this.scrollLogicVertical(delta, offset, total, fixedCount, maxSize, function (row) {
      if (row - offset < fixedCount && row - offset >= 0) {
        return instance.getSetting('rowHeight', row - offset);
      }
      else {
        return instance.getSetting('rowHeight', row);
      }
    }, function (isReverse) {
      instance.wtTable.verticalRenderReverse = isReverse;
    });
  }
  else {
    newOffset = 0;
  }

  if (newOffset !== offset) {
    this.instance.wtScrollbars.vertical.scrollTo(newOffset);
  }
  return instance;
};

WalkontableScroll.prototype.scrollHorizontal = function (delta) {
  if (!this.instance.drawn) {
    throw new Error('scrollHorizontal can only be called after table was drawn to DOM');
  }

  var instance = this.instance
    , newOffset
    , offset = instance.getSetting('offsetColumn')
    , fixedCount = instance.getSetting('fixedColumnsLeft')
    , total = instance.getSetting('totalColumns')
    , maxSize = instance.wtViewport.getViewportWidth();

  if (total > 0) {
    newOffset = this.scrollLogicHorizontal(delta, offset, total, fixedCount, maxSize, function (col) {
      if (col - offset < fixedCount && col - offset >= 0) {
        return instance.getSetting('columnWidth', col - offset);
      }
      else {
        return instance.getSetting('columnWidth', col);
      }
    });
  }
  else {
    newOffset = 0;
  }

  if (newOffset !== offset) {
    this.instance.wtScrollbars.horizontal.scrollTo(newOffset);
  }
  return instance;
};

WalkontableScroll.prototype.scrollLogicVertical = function (delta, offset, total, fixedCount, maxSize, cellSizeFn, setReverseRenderFn) {
  var newOffset = offset + delta;

  if (newOffset >= total - fixedCount) {
    newOffset = total - fixedCount - 1;
    setReverseRenderFn(true);
  }
  else if (newOffset < 0) {
    newOffset = 0;
  }

  return newOffset;
};

WalkontableScroll.prototype.scrollLogicHorizontal = function (delta, offset, total, fixedCount, maxSize, cellSizeFn) {
  var newOffset = offset + delta
    , sum = 0
    , col;

  if (newOffset > fixedCount) {
    if (newOffset >= total - fixedCount) {
      newOffset = total - fixedCount - 1;
    }

    col = newOffset;
    while (sum < maxSize && col < total) {
      sum += cellSizeFn(col);
      col++;
    }

    if (sum < maxSize) {
      while (newOffset > 0) {
        //if sum still less than available width, we cannot scroll that far (must move offset to the left)
        sum += cellSizeFn(newOffset - 1);
        if (sum < maxSize) {
          newOffset--;
        }
        else {
          break;
        }
      }
    }
  }
  else if (newOffset < 0) {
    newOffset = 0;
  }

  return newOffset;
};

/**
 * Scrolls viewport to a cell by minimum number of cells
 */
WalkontableScroll.prototype.scrollViewport = function (coords) {
  var offsetRow = this.instance.getSetting('offsetRow')
    , offsetColumn = this.instance.getSetting('offsetColumn')
    , lastVisibleRow = this.instance.wtTable.getLastVisibleRow()
    , lastVisibleColumn = this.instance.wtTable.getLastVisibleColumn()
    , totalRows = this.instance.getSetting('totalRows')
    , totalColumns = this.instance.getSetting('totalColumns')
    , fixedRowsTop = this.instance.getSetting('fixedRowsTop')
    , fixedColumnsLeft = this.instance.getSetting('fixedColumnsLeft');

  if (coords[0] < 0 || coords[0] > totalRows - 1) {
    throw new Error('row ' + coords[0] + ' does not exist');
  }
  else if (coords[1] < 0 || coords[1] > totalColumns - 1) {
    throw new Error('column ' + coords[1] + ' does not exist');
  }

  if (coords[0] > lastVisibleRow) {
//    this.scrollVertical(coords[0] - lastVisibleRow + 1);
    this.scrollVertical(coords[0] - fixedRowsTop - offsetRow);
    this.instance.wtTable.verticalRenderReverse = true;
  }
  else if (coords[0] === lastVisibleRow && this.instance.wtTable.rowStrategy.isLastIncomplete()) {
//    this.scrollVertical(coords[0] - lastVisibleRow + 1);
    this.scrollVertical(coords[0] - fixedRowsTop - offsetRow);
    this.instance.wtTable.verticalRenderReverse = true;
  }
  else if (coords[0] - fixedRowsTop < offsetRow) {
    this.scrollVertical(coords[0] - fixedRowsTop - offsetRow);
  }
  else {
    this.scrollVertical(0); //Craig's issue: remove row from the last scroll page should scroll viewport a row up if needed
  }

  if (coords[1] > lastVisibleColumn) {
    this.scrollHorizontal(coords[1] - lastVisibleColumn + 1);
  }
  else if (coords[1] === lastVisibleColumn && this.instance.wtTable.columnStrategy.isLastIncomplete()) {
    this.scrollHorizontal(coords[1] - lastVisibleColumn + 1);
  }
  else if (coords[1] - fixedColumnsLeft < offsetColumn) {
    this.scrollHorizontal(coords[1] - fixedColumnsLeft - offsetColumn);
  }
  else {
    this.scrollHorizontal(0); //Craig's issue
  }

  return this.instance;
};

function WalkontableScrollbar() {
}

WalkontableScrollbar.prototype.init = function () {
  var that = this;

  //reference to instance
  this.$table = $(this.instance.wtTable.TABLE);

  //create elements
  this.slider = document.createElement('DIV');
  this.sliderStyle = this.slider.style;
  this.sliderStyle.position = 'absolute';
  this.sliderStyle.top = '0';
  this.sliderStyle.left = '0';
  this.sliderStyle.display = 'none';
  this.slider.className = 'dragdealer ' + this.type;

  this.handle = document.createElement('DIV');
  this.handleStyle = this.handle.style;
  this.handle.className = 'handle';

  this.slider.appendChild(this.handle);
  this.container = this.instance.wtTable.parent;
  this.container.appendChild(this.slider);

  var firstRun = true;
  this.dragTimeout = null;
  var dragDelta;
  var dragRender = function () {
    that.onScroll(dragDelta);
  };

  this.dragdealer = new Dragdealer(this.slider, {
    vertical: (this.type === 'vertical'),
    horizontal: (this.type === 'horizontal'),
    slide: false,
    speed: 100,
    animationCallback: function (x, y) {
      if (firstRun) {
        firstRun = false;
        return;
      }
      that.skipRefresh = true;
      dragDelta = that.type === 'vertical' ? y : x;
      if (that.dragTimeout === null) {
        that.dragTimeout = setInterval(dragRender, 100);
        dragRender();
      }
    },
    callback: function (x, y) {
      that.skipRefresh = false;
      clearInterval(that.dragTimeout);
      that.dragTimeout = null;
      dragDelta = that.type === 'vertical' ? y : x;
      that.onScroll(dragDelta);
    }
  });
  this.skipRefresh = false;
};

WalkontableScrollbar.prototype.onScroll = function (delta) {
  if (this.instance.drawn) {
    this.readSettings();
    if (this.total > this.visibleCount) {
      var newOffset = Math.round(this.handlePosition * this.total / this.sliderSize);

      if (delta === 1) {
        if (this.type === 'vertical') {
          this.instance.scrollVertical(Infinity).draw();
        }
        else {
          this.instance.scrollHorizontal(Infinity).draw();
        }
      }
      else if (newOffset !== this.offset) { //is new offset different than old offset
        if (this.type === 'vertical') {
          this.instance.scrollVertical(newOffset - this.offset).draw();
        }
        else {
          this.instance.scrollHorizontal(newOffset - this.offset).draw();
        }
      }
      else {
        this.refresh();
      }
    }
  }
};

/**
 * Returns what part of the scroller should the handle take
 * @param viewportCount {Number} number of visible rows or columns
 * @param totalCount {Number} total number of rows or columns
 * @return {Number} 0..1
 */
WalkontableScrollbar.prototype.getHandleSizeRatio = function (viewportCount, totalCount) {
  if (!totalCount || viewportCount > totalCount) {
    return 1;
  }
  return viewportCount / totalCount;
};

WalkontableScrollbar.prototype.prepare = function () {
  if (this.skipRefresh) {
    return;
  }
  var ratio = this.getHandleSizeRatio(this.visibleCount, this.total);
  if (((ratio === 1 || isNaN(ratio)) && this.scrollMode === 'auto') || this.scrollMode === 'none') {
    //isNaN is needed because ratio equals NaN when totalRows/totalColumns equals 0
    this.visible = false;
  }
  else {
    this.visible = true;
  }
};

WalkontableScrollbar.prototype.refresh = function () {
  if (this.skipRefresh) {
    return;
  }
  else if (!this.visible) {
    this.sliderStyle.display = 'none';
    return;
  }

  var ratio
    , sliderSize
    , handleSize
    , handlePosition
    , visibleCount = this.visibleCount
    , tableWidth = this.instance.wtViewport.getWorkspaceWidth()
    , tableHeight = this.instance.wtViewport.getWorkspaceHeight();

  if (tableWidth === Infinity) {
    tableWidth = this.instance.wtViewport.getWorkspaceActualWidth();
  }

  if (tableHeight === Infinity) {
    tableHeight = this.instance.wtViewport.getWorkspaceActualHeight();
  }

  if (this.type === 'vertical') {
    if (this.instance.wtTable.rowStrategy.isLastIncomplete()) {
      visibleCount--;
    }

    sliderSize = tableHeight - 2; //2 is sliders border-width

    this.sliderStyle.top = this.instance.wtDom.offset(this.$table[0]).top - this.instance.wtDom.offset(this.container).top + 'px';
    this.sliderStyle.left = tableWidth - 1 + 'px'; //1 is sliders border-width
    this.sliderStyle.height = Math.max(sliderSize, 0) + 'px';
  }
  else { //horizontal
    if (this.instance.wtTable.columnStrategy.isLastIncomplete()) {
      visibleCount--;
    }

    sliderSize = tableWidth - 2; //2 is sliders border-width

    this.sliderStyle.left = this.instance.wtDom.offset(this.$table[0]).left - this.instance.wtDom.offset(this.container).left + 'px';
    this.sliderStyle.top = tableHeight - 1 + 'px'; //1 is sliders border-width
    this.sliderStyle.width = Math.max(sliderSize, 0) + 'px';
  }

  ratio = this.getHandleSizeRatio(visibleCount, this.total);
  handleSize = Math.round(sliderSize * ratio);
  if (handleSize < 10) {
    handleSize = 15;
  }

  handlePosition = Math.floor(sliderSize * (this.offset / this.total));
  if (handleSize + handlePosition > sliderSize) {
    handlePosition = sliderSize - handleSize;
  }

  if (this.type === 'vertical') {
    this.handleStyle.height = handleSize + 'px';
    this.handleStyle.top = handlePosition + 'px';

  }
  else { //horizontal
    this.handleStyle.width = handleSize + 'px';
    this.handleStyle.left = handlePosition + 'px';
  }

  this.sliderStyle.display = 'block';
};

WalkontableScrollbar.prototype.destroy = function () {
  clearInterval(this.dragdealer.interval);
};

///

var WalkontableVerticalScrollbar = function (instance) {
  this.instance = instance;
  this.type = 'vertical';
  this.init();
};

WalkontableVerticalScrollbar.prototype = new WalkontableScrollbar();

WalkontableVerticalScrollbar.prototype.scrollTo = function (cell) {
  this.instance.update('offsetRow', cell);
};

WalkontableVerticalScrollbar.prototype.readSettings = function () {
  this.scrollMode = this.instance.getSetting('scrollV');
  this.offset = this.instance.getSetting('offsetRow');
  this.total = this.instance.getSetting('totalRows');
  this.visibleCount = this.instance.wtTable.rowStrategy.countVisible();
  if(this.visibleCount > 1 && this.instance.wtTable.rowStrategy.isLastIncomplete()) {
    this.visibleCount--;
  }
  this.handlePosition = parseInt(this.handleStyle.top, 10);
  this.sliderSize = parseInt(this.sliderStyle.height, 10);
  this.fixedCount = this.instance.getSetting('fixedRowsTop');
};

///

var WalkontableHorizontalScrollbar = function (instance) {
  this.instance = instance;
  this.type = 'horizontal';
  this.init();
};

WalkontableHorizontalScrollbar.prototype = new WalkontableScrollbar();

WalkontableHorizontalScrollbar.prototype.scrollTo = function (cell) {
  this.instance.update('offsetColumn', cell);
};

WalkontableHorizontalScrollbar.prototype.readSettings = function () {
  this.scrollMode = this.instance.getSetting('scrollH');
  this.offset = this.instance.getSetting('offsetColumn');
  this.total = this.instance.getSetting('totalColumns');
  this.visibleCount = this.instance.wtTable.columnStrategy.countVisible();
  if(this.visibleCount > 1 && this.instance.wtTable.columnStrategy.isLastIncomplete()) {
    this.visibleCount--;
  }
  this.handlePosition = parseInt(this.handleStyle.left, 10);
  this.sliderSize = parseInt(this.sliderStyle.width, 10);
  this.fixedCount = this.instance.getSetting('fixedColumnsLeft');
};
function WalkontableScrollbarNative() {
  this.lastWindowScrollPosition = NaN;
}

WalkontableScrollbarNative.prototype.init = function () {
  this.fixedContainer = this.instance.wtTable.TABLE.parentNode.parentNode.parentNode;
  this.fixed = this.instance.wtTable.TABLE.parentNode.parentNode;
  this.TABLE = this.instance.wtTable.TABLE;
  this.$scrollHandler = $(window); //in future remove jQuery from here

  var that = this;
  this.$scrollHandler.on('scroll.walkontable', function () {
    if (!that.instance.wtTable.parent.parentNode) {
      //Walkontable was detached from DOM, but this handler was not removed
      that.destroy();
      return;
    }

    that.onScroll();
  });

  this.readSettings();
};

WalkontableScrollbarNative.prototype.onScroll = function () {
  this.readSettings();
  if (this.windowScrollPosition === this.lastWindowScrollPosition) {
    return;
  }
  this.lastWindowScrollPosition = this.windowScrollPosition;

  var scrollDelta;
  var newOffset = 0;

  if (this.windowScrollPosition > this.tableParentOffset) {
    scrollDelta = this.windowScrollPosition - this.tableParentOffset;
    newOffset = Math.ceil(scrollDelta / 20, 10);
    newOffset = Math.min(newOffset, this.total)
  }

  this.instance.update('offsetRow', newOffset);
  this.instance.draw();
};

WalkontableScrollbarNative.prototype.prepare = function () {
};

WalkontableScrollbarNative.prototype.availableSize = function () {
  var availableSize;

  //var last = this.getLastCell();
  if (this.windowScrollPosition > this.tableParentOffset /*&& last > -1*/) { //last -1 means that viewport is scrolled behind the table
    if (this.instance.wtTable.getLastVisibleRow() === this.total - 1) {
      availableSize = this.instance.wtDom.outerHeight(this.TABLE);
    }
    else {
      availableSize = this.windowSize;
    }
  }
  else {
    availableSize = this.windowSize - (this.tableParentOffset - this.windowScrollPosition);
  }

  return availableSize;
};

WalkontableScrollbarNative.prototype.refresh = function () {
  var last = this.getLastCell();
  this.measureBefore = this.offset * this.cellSize;
  this.measureInside = this.getTableSize();
  if (last === -1) { //last -1 means that viewport is scrolled behind the table
    this.measureAfter = 0;
  }
  else {
    this.measureAfter = (this.total - last - 1) * this.cellSize;
  }
  this.applyToDOM();
};

WalkontableScrollbarNative.prototype.destroy = function () {
  this.$scrollHandler.off('scroll.walkontable');
};

///

var WalkontableVerticalScrollbarNative = function (instance) {
  this.instance = instance;
  this.type = 'vertical';
  this.cellSize = 20;
  this.init();
};

WalkontableVerticalScrollbarNative.prototype = new WalkontableScrollbarNative();

WalkontableVerticalScrollbarNative.prototype.getLastCell = function () {
  return this.instance.wtTable.getLastVisibleRow();
};

WalkontableVerticalScrollbarNative.prototype.getTableSize = function () {
  return this.instance.wtDom.outerHeight(this.TABLE);
};

WalkontableVerticalScrollbarNative.prototype.applyToDOM = function () {
  if (this.windowScrollPosition > this.tableParentOffset /*&& last > -1*/) { //last -1 means that viewport is scrolled behind the table
    this.fixed.style.position = 'fixed';
    this.fixed.style.top = '0';
    this.fixed.style.left = this.tableParentOtherOffset;
  }
  else {
    this.fixed.style.position = 'relative';
  }

  var debug = false;
  if (debug) {
    //this.fixedContainer.style.borderTop = this.measureBefore + 'px solid red';
    //this.fixedContainer.style.borderBottom = (this.tableSize + this.measureAfter) + 'px solid blue';
  }
  else {
    this.fixedContainer.style.paddingTop = this.measureBefore + 'px';
    this.fixedContainer.style.paddingBottom = (this.measureInside + this.measureAfter) + 'px';
  }
};

WalkontableVerticalScrollbarNative.prototype.scrollTo = function (cell) {
  this.$scrollHandler.scrollTop(this.tableParentOffset + cell * this.cellSize);
};

WalkontableVerticalScrollbarNative.prototype.readSettings = function () {
  var offset = this.instance.wtDom.offset(this.fixedContainer);
  this.tableParentOffset = offset.top;
  this.tableParentOtherOffset = offset.left;
  this.windowSize = this.$scrollHandler.height();
  this.windowScrollPosition = this.$scrollHandler.scrollTop();
  this.offset = this.instance.getSetting('offsetRow');
  this.total = this.instance.getSetting('totalRows');
};

///

var WalkontableHorizontalScrollbarNative = function (instance) {
  this.instance = instance;
  this.type = 'horizontal';
  this.cellSize = 50;
  this.init();
};

WalkontableHorizontalScrollbarNative.prototype = new WalkontableScrollbarNative();

WalkontableHorizontalScrollbarNative.prototype.getLastCell = function () {
  return this.instance.wtTable.getLastVisibleColumn();
};

WalkontableHorizontalScrollbarNative.prototype.getTableSize = function () {
  return this.instance.wtDom.outerWidth(this.TABLE);
};

WalkontableHorizontalScrollbarNative.prototype.applyToDOM = function () {
  if (this.windowScrollPosition > this.tableParentOffset /*&& last > -1*/) { //last -1 means that viewport is scrolled behind the table
    this.fixed.style.position = 'fixed';
    this.fixed.style.left = '0';
    this.fixed.style.top = this.tableParentOtherOffset;
  }
  else {
    this.fixed.style.position = 'relative';
  }

  var debug = false;
  if (debug) {
    //this.fixedContainer.style.borderLeft = this.measureBefore + 'px solid red';
    //this.fixedContainer.style.borderBottom = (this.tableSize + this.measureAfter) + 'px solid blue';
  }
  else {
    this.fixedContainer.style.paddingLeft = this.measureBefore + 'px';
    this.fixedContainer.style.paddingRight = (this.measureInside + this.measureAfter) + 'px';
  }
};

WalkontableHorizontalScrollbarNative.prototype.scrollTo = function (cell) {
  this.$scrollHandler.scrollLeft(this.tableParentOffset + cell * this.cellSize);
};

WalkontableHorizontalScrollbarNative.prototype.readSettings = function () {
  var offset = this.instance.wtDom.offset(this.fixedContainer);
  this.tableParentOffset = offset.left;
  this.tableParentOtherOffset = offset.top;
  this.windowSize = this.$scrollHandler.width();
  this.windowScrollPosition = this.$scrollHandler.scrollLeft();
  this.offset = this.instance.getSetting('offsetColumn');
  this.total = this.instance.getSetting('totalColumns');
};
function WalkontableScrollbars(instance) {
  switch (instance.getSetting('scrollbarModelV')) {
    case 'dragdealer':
      this.vertical = new WalkontableVerticalScrollbar(instance);
      break;

    case 'native':
      this.vertical = new WalkontableVerticalScrollbarNative(instance);
      break;
  }

  switch (instance.getSetting('scrollbarModelH')) {
    case 'dragdealer':
      this.horizontal = new WalkontableHorizontalScrollbar(instance);
      break;

    case 'native':
      this.horizontal = new WalkontableHorizontalScrollbarNative(instance);
      break;
  }
}

WalkontableScrollbars.prototype.destroy = function () {
  this.vertical.destroy();
  this.horizontal.destroy();
};

WalkontableScrollbars.prototype.refresh = function () {
  this.horizontal.readSettings();
  this.vertical.readSettings();
  this.horizontal.prepare();
  this.vertical.prepare();
  this.horizontal.refresh();
  this.vertical.refresh();
};
function WalkontableSelection(instance, settings) {
  this.instance = instance;
  this.settings = settings;
  this.selected = [];
  if (settings.border) {
    this.border = new WalkontableBorder(instance, settings);
  }
}

WalkontableSelection.prototype.add = function (coords) {
  this.selected.push(coords);
};

WalkontableSelection.prototype.clear = function () {
  this.selected.length = 0; //http://jsperf.com/clear-arrayxxx
};

/**
 * Returns the top left (TL) and bottom right (BR) selection coordinates
 * @returns {Object}
 */
WalkontableSelection.prototype.getCorners = function () {
  var minRow
    , minColumn
    , maxRow
    , maxColumn
    , i
    , ilen = this.selected.length;

  if (ilen > 0) {
    minRow = maxRow = this.selected[0][0];
    minColumn = maxColumn = this.selected[0][1];

    if (ilen > 1) {
      for (i = 1; i < ilen; i++) {
        if (this.selected[i][0] < minRow) {
          minRow = this.selected[i][0];
        }
        else if (this.selected[i][0] > maxRow) {
          maxRow = this.selected[i][0];
        }

        if (this.selected[i][1] < minColumn) {
          minColumn = this.selected[i][1];
        }
        else if (this.selected[i][1] > maxColumn) {
          maxColumn = this.selected[i][1];
        }
      }
    }
  }

  return [minRow, minColumn, maxRow, maxColumn];
};

WalkontableSelection.prototype.draw = function () {
  var corners, r, c, source_r, source_c;

  var visibleRows = this.instance.wtTable.rowStrategy.countVisible()
    , visibleColumns = this.instance.wtTable.columnStrategy.countVisible();

  if (this.selected.length) {
    corners = this.getCorners();

    for (r = 0; r < visibleRows; r++) {
      for (c = 0; c < visibleColumns; c++) {
        source_r = this.instance.wtTable.rowFilter.visibleToSource(r);
        source_c = this.instance.wtTable.columnFilter.visibleToSource(c);

        if (source_r >= corners[0] && source_r <= corners[2] && source_c >= corners[1] && source_c <= corners[3]) {
          //selected cell
          this.instance.wtTable.currentCellCache.add(r, c, this.settings.className);
        }
        else if (source_r >= corners[0] && source_r <= corners[2]) {
          //selection is in this row
          this.instance.wtTable.currentCellCache.add(r, c, this.settings.highlightRowClassName);
        }
        else if (source_c >= corners[1] && source_c <= corners[3]) {
          //selection is in this column
          this.instance.wtTable.currentCellCache.add(r, c, this.settings.highlightColumnClassName);
        }
      }
    }

    this.border && this.border.appear(corners); //warning! border.appear modifies corners!
  }
  else {
    this.border && this.border.disappear();
  }
};

function WalkontableSettings(instance, settings) {
  var that = this;
  this.instance = instance;

  //default settings. void 0 means it is required, null means it can be empty
  this.defaults = {
    table: void 0,

    //presentation mode
    scrollH: 'auto', //values: scroll (always show scrollbar), auto (show scrollbar if table does not fit in the container), none (never show scrollbar)
    scrollV: 'auto', //values: see above
    scrollbarModelH: 'dragdealer', //values: dragdealer, native
    scrollbarModelV: 'dragdealer', //values: dragdealer, native
    stretchH: 'hybrid', //values: hybrid, all, last, none
    currentRowClassName: null,
    currentColumnClassName: null,

    //data source
    data: void 0,
    offsetRow: 0,
    offsetColumn: 0,
    fixedColumnsLeft: 0,
    fixedRowsTop: 0,
    rowHeaders: function () {
      return []
    }, //this must be array of functions: [function (row, TH) {}]
    columnHeaders: function () {
      return []
    }, //this must be array of functions: [function (column, TH) {}]
    totalRows: void 0,
    totalColumns: void 0,
    width: null,
    height: null,
    cellRenderer: function (row, column, TD) {
      var cellData = that.getSetting('data', row, column);
      that.instance.wtDom.fastInnerText(TD, cellData === void 0 || cellData === null ? '' : cellData);
    },
    columnWidth: 50,
    selections: null,
    hideBorderOnMouseDownOver: false,

    //callbacks
    onCellMouseDown: null,
    onCellMouseOver: null,
//    onCellMouseOut: null,
    onCellDblClick: null,
    onCellCornerMouseDown: null,
    onCellCornerDblClick: null,
    beforeDraw: null,
    onDraw: null,

    //constants
    scrollbarWidth: 10,
    scrollbarHeight: 10
  };

  //reference to settings
  this.settings = {};
  for (var i in this.defaults) {
    if (this.defaults.hasOwnProperty(i)) {
      if (settings[i] !== void 0) {
        this.settings[i] = settings[i];
      }
      else if (this.defaults[i] === void 0) {
        throw new Error('A required setting "' + i + '" was not provided');
      }
      else {
        this.settings[i] = this.defaults[i];
      }
    }
  }
}

/**
 * generic methods
 */

WalkontableSettings.prototype.update = function (settings, value) {
  if (value === void 0) { //settings is object
    for (var i in settings) {
      if (settings.hasOwnProperty(i)) {
        this.settings[i] = settings[i];
      }
    }
  }
  else { //if value is defined then settings is the key
    this.settings[settings] = value;
  }
  return this.instance;
};

WalkontableSettings.prototype.getSetting = function (key, param1, param2, param3) {
  if (this[key]) {
    return this[key](param1, param2, param3);
  }
  else {
    return this._getSetting(key, param1, param2, param3);
  }
};

WalkontableSettings.prototype._getSetting = function (key, param1, param2, param3) {
  if (typeof this.settings[key] === 'function') {
    return this.settings[key](param1, param2, param3);
  }
  else if (param1 !== void 0 && Object.prototype.toString.call(this.settings[key]) === '[object Array]') {
    return this.settings[key][param1];
  }
  else {
    return this.settings[key];
  }
};

WalkontableSettings.prototype.has = function (key) {
  return !!this.settings[key]
};

/**
 * specific methods
 */

WalkontableSettings.prototype.rowHeight = function (row) {
  var visible_r = this.instance.wtTable.rowFilter.sourceToVisible(row);
  var size = this.instance.wtTable.rowStrategy.getSize(visible_r);
  if (size !== void 0) {
    return size;
  }
  return 20;
};

WalkontableSettings.prototype.columnWidth = function (column) {
  return Math.min(200, this._getSetting('columnWidth', column));
};
/*var FLAG_VISIBLE_HORIZONTAL = 0x1; // 000001
 var FLAG_VISIBLE_VERTICAL = 0x2; // 000010
 var FLAG_PARTIALLY_VISIBLE_HORIZONTAL = 0x4; // 000100
 var FLAG_PARTIALLY_VISIBLE_VERTICAL = 0x8; // 001000
 var FLAG_NOT_VISIBLE_HORIZONTAL = 0x10; // 010000
 var FLAG_NOT_VISIBLE_VERTICAL = 0x20; // 100000*/

function WalkontableTable(instance) {
  //reference to instance
  this.instance = instance;
  this.TABLE = this.instance.getSetting('table');
  this.wtDom = this.instance.wtDom;
  this.wtDom.removeTextNodes(this.TABLE);

  //wtSpreader
  var parent = this.TABLE.parentNode;
  if (!parent || parent.nodeType !== 1 || !this.wtDom.hasClass(parent, 'wtHolder')) {
    var spreader = document.createElement('DIV');
    spreader.className = 'wtSpreader';
    if (parent) {
      parent.insertBefore(spreader, this.TABLE); //if TABLE is detached (e.g. in Jasmine test), it has no parentNode so we cannot attach holder to it
    }
    spreader.appendChild(this.TABLE);
  }
  this.spreader = this.TABLE.parentNode;

  //wtHider
  parent = this.spreader.parentNode;
  if (!parent || parent.nodeType !== 1 || !this.wtDom.hasClass(parent, 'wtHolder')) {
    var hider = document.createElement('DIV');
    hider.className = 'wtHider';
    if (parent) {
      parent.insertBefore(hider, this.spreader); //if TABLE is detached (e.g. in Jasmine test), it has no parentNode so we cannot attach holder to it
    }
    hider.appendChild(this.spreader);
  }
  this.hider = this.spreader.parentNode;
  this.hiderStyle = this.hider.style;
  this.hiderStyle.position = 'relative';

  //wtHolder
  parent = this.hider.parentNode;
  if (!parent || parent.nodeType !== 1 || !this.wtDom.hasClass(parent, 'wtHolder')) {
    var holder = document.createElement('DIV');
    holder.style.position = 'relative';
    holder.className = 'wtHolder';
    if (parent) {
      parent.insertBefore(holder, this.hider); //if TABLE is detached (e.g. in Jasmine test), it has no parentNode so we cannot attach holder to it
    }
    holder.appendChild(this.hider);
  }
  this.parent = this.hider.parentNode;

  //bootstrap from settings
  this.TBODY = this.TABLE.getElementsByTagName('TBODY')[0];
  if (!this.TBODY) {
    this.TBODY = document.createElement('TBODY');
    this.TABLE.appendChild(this.TBODY);
  }
  this.THEAD = this.TABLE.getElementsByTagName('THEAD')[0];
  if (!this.THEAD) {
    this.THEAD = document.createElement('THEAD');
    this.TABLE.insertBefore(this.THEAD, this.TBODY);
  }
  this.COLGROUP = this.TABLE.getElementsByTagName('COLGROUP')[0];
  if (!this.COLGROUP) {
    this.COLGROUP = document.createElement('COLGROUP');
    this.TABLE.insertBefore(this.COLGROUP, this.THEAD);
  }

  if (this.instance.getSetting('columnHeaders').length) {
    if (!this.THEAD.childNodes.length) {
      var TR = document.createElement('TR');
      this.THEAD.appendChild(TR);
    }
  }

  this.colgroupChildrenLength = this.COLGROUP.childNodes.length;
  this.theadChildrenLength = this.THEAD.firstChild ? this.THEAD.firstChild.childNodes.length : 0;
  this.tbodyChildrenLength = this.TBODY.childNodes.length;

  this.oldCellCache = new WalkontableClassNameCache();
  this.currentCellCache = new WalkontableClassNameCache();

  this.rowFilter = new WalkontableRowFilter();
  this.columnFilter = new WalkontableColumnFilter();

  this.verticalRenderReverse = false;
}

WalkontableTable.prototype.refreshHiderDimensions = function () {
  var height = this.instance.wtViewport.getWorkspaceHeight();
  var width = this.instance.wtViewport.getWorkspaceWidth();

  var spreaderStyle = this.spreader.style;

  if (height !== Infinity || width !== Infinity) {
    if (height === Infinity) {
      height = this.instance.wtViewport.getWorkspaceActualHeight();
    }
    if (width === Infinity) {
      width = this.instance.wtViewport.getWorkspaceActualWidth();
    }

    this.hiderStyle.overflow = 'hidden';

    spreaderStyle.position = 'absolute';
    spreaderStyle.top = '0';
    spreaderStyle.left = '0';

    if (this.instance.getSetting('scrollbarModelV') === 'dragdealer') {
      spreaderStyle.height = '4000px';
    }

    if (this.instance.getSetting('scrollbarModelH') === 'dragdealer') {
      spreaderStyle.width = '4000px';
    }

    this.hiderStyle.height = height + 'px';
    this.hiderStyle.width = width + 'px';
  }
  else {
    spreaderStyle.position = 'relative';
    spreaderStyle.width = 'auto';
    spreaderStyle.height = 'auto';
  }
};

WalkontableTable.prototype.refreshStretching = function () {
  var instance = this.instance
    , stretchH = instance.getSetting('stretchH')
    , totalRows = instance.getSetting('totalRows')
    , totalColumns = instance.getSetting('totalColumns')
    , offsetColumn = instance.getSetting('offsetColumn');

  var containerWidthFn = function (cacheWidth) {
    return that.instance.wtViewport.getViewportWidth(cacheWidth);
  };

  var that = this;

  var columnWidthFn = function (i) {
    var source_c = that.columnFilter.visibleToSource(i);
    if (source_c < totalColumns) {
      return instance.getSetting('columnWidth', source_c);
    }
  };

  if (stretchH === 'hybrid') {
    if (offsetColumn > 0) {
      stretchH = 'last';
    }
    else {
      stretchH = 'none';
    }
  }

  var containerHeightFn = function (cacheHeight) {
    return that.instance.wtViewport.getViewportHeight(cacheHeight);
  };

  var rowHeightFn = function (i, TD) {
    var source_r = that.rowFilter.visibleToSource(i);
    if (source_r < totalRows) {
      if (that.verticalRenderReverse && i === 0) {
        return that.wtDom.outerHeight(TD) - 1;
      }
      else {
        return that.wtDom.outerHeight(TD);
      }
    }
  };

  this.columnStrategy = new WalkontableColumnStrategy(containerWidthFn, columnWidthFn, stretchH);
  this.rowStrategy = new WalkontableRowStrategy(containerHeightFn, rowHeightFn);
};

WalkontableTable.prototype.adjustAvailableNodes = function () {
  var displayTds
    , rowHeaders = this.instance.getSetting('rowHeaders')
    , displayThs = rowHeaders.length
    , columnHeaders = this.instance.getSetting('columnHeaders')
    , TR
    , TD
    , c;

  //adjust COLGROUP
  while (this.colgroupChildrenLength < displayThs) {
    this.COLGROUP.appendChild(document.createElement('COL'));
    this.colgroupChildrenLength++;
  }

  this.refreshStretching();
  displayTds = this.columnStrategy.cellCount;

  //adjust COLGROUP
  while (this.colgroupChildrenLength < displayTds + displayThs) {
    this.COLGROUP.appendChild(document.createElement('COL'));
    this.colgroupChildrenLength++;
  }
  while (this.colgroupChildrenLength > displayTds + displayThs) {
    this.COLGROUP.removeChild(this.COLGROUP.lastChild);
    this.colgroupChildrenLength--;
  }

  //adjust THEAD
  TR = this.THEAD.firstChild;
  if (columnHeaders.length) {
    if (!TR) {
      TR = document.createElement('TR');
      this.THEAD.appendChild(TR);
    }

    this.theadChildrenLength = TR.childNodes.length;
    while (this.theadChildrenLength < displayTds + displayThs) {
      TR.appendChild(document.createElement('TH'));
      this.theadChildrenLength++;
    }
    while (this.theadChildrenLength > displayTds + displayThs) {
      TR.removeChild(TR.lastChild);
      this.theadChildrenLength--;
    }
  }
  else if (TR) {
    this.wtDom.empty(TR);
  }

  //draw COLGROUP
  for (c = 0; c < this.colgroupChildrenLength; c++) {
    if (c < displayThs) {
      this.wtDom.addClass(this.COLGROUP.childNodes[c], 'rowHeader');
    }
    else {
      this.wtDom.removeClass(this.COLGROUP.childNodes[c], 'rowHeader');
    }
  }

  //draw THEAD
  if (columnHeaders.length) {
    TR = this.THEAD.firstChild;
    if (displayThs) {
      TD = TR.firstChild; //actually it is TH but let's reuse single variable
      for (c = 0; c < displayThs; c++) {
        rowHeaders[c](-displayThs + c, TD);
        TD = TD.nextSibling;
      }
    }
  }

  for (c = 0; c < displayTds; c++) {
    if (columnHeaders.length) {
      columnHeaders[0](this.columnFilter.visibleToSource(c), TR.childNodes[displayThs + c]);
    }
  }
};

WalkontableTable.prototype.adjustColumns = function (TR, desiredCount) {
  var count = TR.childNodes.length;
  while (count < desiredCount) {
    var TD = document.createElement('TD');
    TR.appendChild(TD);
    count++;
  }
  while (count > desiredCount) {
    TR.removeChild(TR.lastChild);
    count--;
  }
};

WalkontableTable.prototype.draw = function (selectionsOnly) {
  this.rowFilter.readSettings(this.instance);
  this.columnFilter.readSettings(this.instance);

  if (!selectionsOnly) {
    this.tableOffset = this.wtDom.offset(this.TABLE);
    this._doDraw();
  }
  else {
    this.instance.wtScrollbars.refresh();
  }

  this.refreshPositions(selectionsOnly);

  this.instance.drawn = true;
  return this;
};

WalkontableTable.prototype._doDraw = function () {
  var r = 0
    , source_r
    , c
    , source_c
    , offsetRow = this.instance.getSetting('offsetRow')
    , totalRows = this.instance.getSetting('totalRows')
    , totalColumns = this.instance.getSetting('totalColumns')
    , displayTds
    , rowHeaders = this.instance.getSetting('rowHeaders')
    , displayThs = rowHeaders.length
    , TR
    , TD
    , TH
    , adjusted = false
    , workspaceWidth;

  this.instance.wtViewport.resetSettings();

  var noPartial = false;
  if (this.verticalRenderReverse) {
    if (offsetRow === totalRows - this.rowFilter.fixedCount - 1) {
      noPartial = true;
    }
    else {
      this.instance.update('offsetRow', offsetRow + 1); //if we are scrolling reverse
      this.rowFilter.readSettings(this.instance);
    }
  }

  //draw TBODY
  if (totalColumns > 0) {
    source_r = this.rowFilter.visibleToSource(r);

    var first = true;

    while (source_r < totalRows && source_r >= 0) {
      if (r >= this.tbodyChildrenLength || (this.verticalRenderReverse && r >= this.rowFilter.fixedCount)) {
        TR = document.createElement('TR');
        for (c = 0; c < displayThs; c++) {
          TR.appendChild(document.createElement('TH'));
        }
        if (this.verticalRenderReverse && r >= this.rowFilter.fixedCount) {
          this.TBODY.insertBefore(TR, this.TBODY.childNodes[this.rowFilter.fixedCount] || this.TBODY.firstChild);
        }
        else {
          this.TBODY.appendChild(TR);
        }
        this.tbodyChildrenLength++;
      }
      else if (r === 0) {
        TR = this.TBODY.firstChild;
      }
      else {
        TR = TR.nextSibling; //http://jsperf.com/nextsibling-vs-indexed-childnodes
      }

      //TH
      TH = TR.firstChild;
      for (c = 0; c < displayThs; c++) {

        //If the number of row headers increased we need to replace TD with TH
        if (TH.nodeName == 'TD') {
          TD = TH;
          TH = document.createElement('TH');
          TR.insertBefore(TH, TD);
          TR.removeChild(TD);
        }

        rowHeaders[c](source_r, TH); //actually TH
        TH = TH.nextSibling; //http://jsperf.com/nextsibling-vs-indexed-childnodes
      }

      if (first) {
//      if (r === 0) {
        first = false;

        this.adjustAvailableNodes();
        adjusted = true;
        displayTds = this.columnStrategy.cellCount;

        //TD
        this.adjustColumns(TR, displayTds + displayThs);

        workspaceWidth = this.instance.wtViewport.getWorkspaceWidth();
        this.columnStrategy.stretch();
        for (c = 0; c < displayTds; c++) {
          this.COLGROUP.childNodes[c + displayThs].style.width = this.columnStrategy.getSize(c) + 'px';
        }
      }
      else {
        //TD
        this.adjustColumns(TR, displayTds + displayThs);
      }

      for (c = 0; c < displayTds; c++) {
        source_c = this.columnFilter.visibleToSource(c);
        if (c === 0) {
          TD = TR.childNodes[this.columnFilter.sourceColumnToVisibleRowHeadedColumn(source_c)];
        }
        else {
          TD = TD.nextSibling; //http://jsperf.com/nextsibling-vs-indexed-childnodes
        }

        //If the number of headers has been reduced, we need to replace excess TH with TD
        if (TD.nodeName == 'TH') {
          TH = TD;
          TD = document.createElement('TD');
          TR.insertBefore(TD, TH);
          TR.removeChild(TH);
        }

        TD.className = '';
        TD.removeAttribute('style');
        this.instance.getSetting('cellRenderer', source_r, source_c, TD);
      }

      offsetRow = this.instance.getSetting('offsetRow'); //refresh the value

      //after last column is rendered, check if last cell is fully displayed
      if (this.verticalRenderReverse && noPartial) {
        if (-this.wtDom.outerHeight(TR.firstChild) < this.rowStrategy.remainingSize) {
          this.TBODY.removeChild(TR);
          this.instance.update('offsetRow', offsetRow + 1);
          this.tbodyChildrenLength--;
          this.rowFilter.readSettings(this.instance);
          break;

        }
        else {
          this.rowStrategy.add(r, TD);
        }
      }
      else {
        this.rowStrategy.add(r, TD);

        if (this.rowStrategy.isLastIncomplete()) {
          break;
        }
      }

      if (this.verticalRenderReverse && r >= this.rowFilter.fixedCount) {
        if (offsetRow === 0) {
          break;
        }
        this.instance.update('offsetRow', offsetRow - 1);
        this.rowFilter.readSettings(this.instance);
      }
      else {
        r++;
      }

      source_r = this.rowFilter.visibleToSource(r);
    }
  }

  if (!adjusted) {
    this.adjustAvailableNodes();
  }

  r = this.rowStrategy.countVisible();
  while (this.tbodyChildrenLength > r) {
    this.TBODY.removeChild(this.TBODY.lastChild);
    this.tbodyChildrenLength--;
  }

  this.instance.wtScrollbars.refresh();

  if (workspaceWidth !== this.instance.wtViewport.getWorkspaceWidth()) {
    //workspace width changed though to shown/hidden vertical scrollbar. Let's reapply stretching
    this.columnStrategy.stretch();
    for (c = 0; c < this.columnStrategy.cellCount; c++) {
      this.COLGROUP.childNodes[c + displayThs].style.width = this.columnStrategy.getSize(c) + 'px';
    }
  }

  this.verticalRenderReverse = false;
};

WalkontableTable.prototype.refreshPositions = function (selectionsOnly) {
  this.refreshHiderDimensions();
  this.refreshSelections(selectionsOnly);
};

WalkontableTable.prototype.refreshSelections = function (selectionsOnly) {
  var vr
    , r
    , vc
    , c
    , s
    , slen
    , classNames = []
    , visibleRows = this.rowStrategy.countVisible()
    , visibleColumns = this.columnStrategy.countVisible();

  this.oldCellCache = this.currentCellCache;
  this.currentCellCache = new WalkontableClassNameCache();

  if (this.instance.selections) {
    for (r in this.instance.selections) {
      if (this.instance.selections.hasOwnProperty(r)) {
        this.instance.selections[r].draw();
        if (this.instance.selections[r].settings.className) {
          classNames.push(this.instance.selections[r].settings.className);
        }
        if (this.instance.selections[r].settings.highlightRowClassName) {
          classNames.push(this.instance.selections[r].settings.highlightRowClassName);
        }
        if (this.instance.selections[r].settings.highlightColumnClassName) {
          classNames.push(this.instance.selections[r].settings.highlightColumnClassName);
        }
      }
    }
  }

  slen = classNames.length;

  for (vr = 0; vr < visibleRows; vr++) {
    for (vc = 0; vc < visibleColumns; vc++) {
      r = this.rowFilter.visibleToSource(vr);
      c = this.columnFilter.visibleToSource(vc);
      for (s = 0; s < slen; s++) {
        if (this.currentCellCache.test(vr, vc, classNames[s])) {
          this.wtDom.addClass(this.getCell([r, c]), classNames[s]);
        }
        else if (selectionsOnly && this.oldCellCache.test(vr, vc, classNames[s])) {
          this.wtDom.removeClass(this.getCell([r, c]), classNames[s]);
        }
      }
    }
  }
};

/* this function is not used currently (was used in _doDraw)
 WalkontableTable.prototype.isCellVisible = function (r, c) {
 var out = 0;

 if (this.isRowInViewport(r)) {
 if (this.getLastVisibleRow() === c && this.rowStrategy.remainingSize > 0) {
 out |= FLAG_PARTIALLY_VISIBLE_VERTICAL;
 }
 else {
 out |= FLAG_VISIBLE_VERTICAL;
 }
 }
 else {
 out |= FLAG_NOT_VISIBLE_VERTICAL;
 }

 if (this.isColumnInViewport(c)) {
 if (this.getLastVisibleColumn() === c && this.columnStrategy.remainingSize > 0) {
 out |= FLAG_PARTIALLY_VISIBLE_HORIZONTAL;
 }
 else {
 out |= FLAG_VISIBLE_HORIZONTAL;
 }
 }
 else {
 out |= FLAG_NOT_VISIBLE_HORIZONTAL;
 }

 return out;
 };*/

/**
 * getCell
 * @param {Array} coords
 * @return {Object} HTMLElement on success or {Number} one of the exit codes on error:
 *  -1 row before viewport
 *  -2 row after viewport
 *  -3 column before viewport
 *  -4 column after viewport
 *
 */
WalkontableTable.prototype.getCell = function (coords) {
  if (this.isRowBeforeViewport(coords[0])) {
    return -1; //row before viewport
  }
  else if (this.isRowAfterViewport(coords[0])) {
    return -2; //row after viewport
  }
  else {
    if (this.isColumnBeforeViewport(coords[1])) {
      return -3; //column before viewport
    }
    else if (this.isColumnAfterViewport(coords[1])) {
      return -4; //column after viewport
    }
    else {
      return this.TBODY.childNodes[this.rowFilter.sourceToVisible(coords[0])].childNodes[this.columnFilter.sourceColumnToVisibleRowHeadedColumn(coords[1])];
    }
  }
};

WalkontableTable.prototype.getCoords = function (TD) {
  return [
    this.rowFilter.visibleToSource(this.wtDom.prevSiblings(TD.parentNode).length),
    this.columnFilter.visibleRowHeadedColumnToSourceColumn(TD.cellIndex)
  ];
};

//returns -1 if no row is visible
WalkontableTable.prototype.getLastVisibleRow = function () {
  return this.rowFilter.visibleToSource(this.rowStrategy.cellCount - 1);
};

//returns -1 if no column is visible
WalkontableTable.prototype.getLastVisibleColumn = function () {
  return this.columnFilter.visibleToSource(this.columnStrategy.cellCount - 1);
};

WalkontableTable.prototype.isRowBeforeViewport = function (r) {
  return (this.rowFilter.sourceToVisible(r) < this.rowFilter.fixedCount && r >= this.rowFilter.fixedCount);
};

WalkontableTable.prototype.isRowAfterViewport = function (r) {
  return (r > this.getLastVisibleRow());
};

WalkontableTable.prototype.isColumnBeforeViewport = function (c) {
  return (this.columnFilter.sourceToVisible(c) < this.columnFilter.fixedCount && c >= this.columnFilter.fixedCount);
};

WalkontableTable.prototype.isColumnAfterViewport = function (c) {
  return (c > this.getLastVisibleColumn());
};

WalkontableTable.prototype.isRowInViewport = function (r) {
  return (!this.isRowBeforeViewport(r) && !this.isRowAfterViewport(r));
};

WalkontableTable.prototype.isColumnInViewport = function (c) {
  return (!this.isColumnBeforeViewport(c) && !this.isColumnAfterViewport(c));
};

WalkontableTable.prototype.isLastRowFullyVisible = function () {
  return (this.getLastVisibleRow() === this.instance.getSetting('totalRows') - 1 && !this.rowStrategy.isLastIncomplete());
};

WalkontableTable.prototype.isLastColumnFullyVisible = function () {
  return (this.getLastVisibleColumn() === this.instance.getSetting('totalColumns') - 1 && !this.columnStrategy.isLastIncomplete());
};

function WalkontableViewport(instance) {
  this.instance = instance;
  this.resetSettings();
}

/*WalkontableViewport.prototype.isInSightVertical = function () {
  //is table outside viewport bottom edge
  if (tableTop > windowHeight + scrollTop) {
    return -1;
  }

  //is table outside viewport top edge
  else if (scrollTop > tableTop + tableFakeHeight) {
    return -2;
  }

  //table is in viewport but how much exactly?
  else {

  }
};*/

//used by scrollbar
WalkontableViewport.prototype.getWorkspaceHeight = function (proposedHeight) {
  var height = this.instance.getSetting('height');

  if (height === Infinity || height === void 0 || height === null || height < 1) {
    if (this.instance.wtScrollbars.vertical instanceof WalkontableScrollbarNative) {
      height = this.instance.wtScrollbars.vertical.availableSize();
    }
    else {
      height = Infinity;
    }
  }

  if (height !== Infinity) {
    if (proposedHeight >= height) {
      height -= this.instance.getSetting('scrollbarHeight');
    }
    else if (this.instance.wtScrollbars.horizontal.visible) {
      height -= this.instance.getSetting('scrollbarHeight');
    }
  }

  return height;
};

WalkontableViewport.prototype.getWorkspaceWidth = function (proposedWidth) {
  var width = this.instance.getSetting('width');

  if (width === Infinity || width === void 0 || width === null || width < 1) {
    if (this.instance.wtScrollbars.horizontal instanceof WalkontableScrollbarNative) {
      width = this.instance.wtScrollbars.horizontal.availableSize();
    }
    else {
      width = Infinity;
    }
  }

  if (width !== Infinity) {
    if (proposedWidth >= width) {
      width -= this.instance.getSetting('scrollbarWidth');
    }
    else if (this.instance.wtScrollbars.vertical.visible) {
      width -= this.instance.getSetting('scrollbarWidth');
    }
  }
  return width;
};

WalkontableViewport.prototype.getWorkspaceActualHeight = function () {
  return this.instance.wtDom.outerHeight(this.instance.wtTable.TABLE);
};

WalkontableViewport.prototype.getWorkspaceActualWidth = function () {
  return this.instance.wtDom.outerWidth(this.instance.wtTable.TABLE) || this.instance.wtDom.outerWidth(this.instance.wtTable.TBODY) || this.instance.wtDom.outerWidth(this.instance.wtTable.THEAD); //IE8 reports 0 as <table> offsetWidth;
};

WalkontableViewport.prototype.getViewportHeight = function (proposedHeight) {
  var containerHeight = this.getWorkspaceHeight(proposedHeight);

  if (containerHeight === Infinity) {
    return containerHeight;
  }

  if (isNaN(this.columnHeaderHeight)) {
    var cellOffset = this.instance.wtDom.offset(this.instance.wtTable.TBODY)
      , tableOffset = this.instance.wtTable.tableOffset;
    this.columnHeaderHeight = cellOffset.top - tableOffset.top;
  }

  if (this.columnHeaderHeight > 0) {
    return containerHeight - this.columnHeaderHeight;
  }
  else {
    return containerHeight;
  }
};

WalkontableViewport.prototype.getViewportWidth = function (proposedWidth) {
  var containerWidth = this.getWorkspaceWidth(proposedWidth);

  if (containerWidth === Infinity) {
    return containerWidth;
  }

  if (isNaN(this.rowHeaderWidth)) {
    var TR = this.instance.wtTable.TBODY ? this.instance.wtTable.TBODY.firstChild : null;
    if (TR) {
      var TD = TR.firstChild;
      this.rowHeaderWidth = 0;
      while (TD && TD.nodeName === 'TH') {
        this.rowHeaderWidth += this.instance.wtDom.outerWidth(TD);
        TD = TD.nextSibling;
      }
    }
  }

  if (this.rowHeaderWidth > 0) {
    return containerWidth - this.rowHeaderWidth;
  }
  else {
    return containerWidth;
  }
};

WalkontableViewport.prototype.resetSettings = function () {
  this.rowHeaderWidth = NaN;
  this.columnHeaderHeight = NaN;
};
function WalkontableWheel(instance) {
  if (instance.getSetting('scrollbarModelV') === 'native' || instance.getSetting('scrollbarModelH') === 'native') {
    return;
  }

  $(instance.wtTable.TABLE).on('mousewheel', function (event, delta, deltaX, deltaY) {
    if (!deltaX && !deltaY && delta) { //we are in IE8, see https://github.com/brandonaaron/jquery-mousewheel/issues/53
      deltaY = delta;
    }

    if (deltaY > 0 && instance.getSetting('offsetRow') === 0) {
      return; //attempt to scroll up when it's already showing first row
    }
    else if (deltaY < 0 && instance.wtTable.isLastRowFullyVisible()) {
      return; //attempt to scroll down when it's already showing last row
    }
    else if (deltaX < 0 && instance.getSetting('offsetColumn') === 0) {
      return; //attempt to scroll left when it's already showing first column
    }
    else if (deltaX > 0 && instance.wtTable.isLastColumnFullyVisible()) {
      return; //attempt to scroll right when it's already showing last column
    }

    //now we are sure we really want to scroll
    clearTimeout(instance.wheelTimeout);
    instance.wheelTimeout = setTimeout(function () { //timeout is needed because with fast-wheel scrolling mousewheel event comes dozen times per second
      if (deltaY) {
        //ceil is needed because jquery-mousewheel reports fractional mousewheel deltas on touchpad scroll
        //see http://stackoverflow.com/questions/5527601/normalizing-mousewheel-speed-across-browsers
        if (instance.wtScrollbars.vertical.visible) { // if we see scrollbar
          instance.scrollVertical(-Math.ceil(deltaY)).draw();
        }
      }
      else if (deltaX) {
        if (instance.wtScrollbars.horizontal.visible) { // if we see scrollbar
          instance.scrollHorizontal(Math.ceil(deltaX)).draw();
        }
      }
    }, 0);

    event.preventDefault();
  });
}
/**
 * Dragdealer JS v0.9.5 - patched by Walkontable at lines 66, 309-310, 339-340
 * http://code.ovidiu.ch/dragdealer-js
 *
 * Copyright (c) 2010, Ovidiu Chereches
 * MIT License
 * http://legal.ovidiu.ch/licenses/MIT
 */

/* Cursor */

var Cursor =
{
	x: 0, y: 0,
	init: function()
	{
		this.setEvent('mouse');
		this.setEvent('touch');
	},
	setEvent: function(type)
	{
		var moveHandler = document['on' + type + 'move'] || function(){};
		document['on' + type + 'move'] = function(e)
		{
			moveHandler(e);
			Cursor.refresh(e);
		}
	},
	refresh: function(e)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.type == 'mousemove')
		{
			this.set(e);
		}
		else if(e.touches)
		{
			this.set(e.touches[0]);
		}
	},
	set: function(e)
	{
		if(e.pageX || e.pageY)
		{
			this.x = e.pageX;
			this.y = e.pageY;
		}
		else if(e.clientX || e.clientY)
		{
			this.x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
			this.y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
	}
};
Cursor.init();

/* Position */

var Position =
{
	get: function(obj)
	{
		var curtop = 0, curleft = 0; //Walkontable patch. Original (var curleft = curtop = 0;) created curtop in global scope
		if(obj.offsetParent)
		{
			do
			{
				curleft += obj.offsetLeft;
				curtop += obj.offsetTop;
			}
			while((obj = obj.offsetParent));
		}
		return [curleft, curtop];
	}
};

/* Dragdealer */

var Dragdealer = function(wrapper, options)
{
	if(typeof(wrapper) == 'string')
	{
		wrapper = document.getElementById(wrapper);
	}
	if(!wrapper)
	{
		return;
	}
	var handle = wrapper.getElementsByTagName('div')[0];
	if(!handle || handle.className.search(/(^|\s)handle(\s|$)/) == -1)
	{
		return;
	}
	this.init(wrapper, handle, options || {});
	this.setup();
};
Dragdealer.prototype =
{
	init: function(wrapper, handle, options)
	{
		this.wrapper = wrapper;
		this.handle = handle;
		this.options = options;
		
		this.disabled = this.getOption('disabled', false);
		this.horizontal = this.getOption('horizontal', true);
		this.vertical = this.getOption('vertical', false);
		this.slide = this.getOption('slide', true);
		this.steps = this.getOption('steps', 0);
		this.snap = this.getOption('snap', false);
		this.loose = this.getOption('loose', false);
		this.speed = this.getOption('speed', 10) / 100;
		this.xPrecision = this.getOption('xPrecision', 0);
		this.yPrecision = this.getOption('yPrecision', 0);
		
		this.callback = options.callback || null;
		this.animationCallback = options.animationCallback || null;
		
		this.bounds = {
			left: options.left || 0, right: -(options.right || 0),
			top: options.top || 0, bottom: -(options.bottom || 0),
			x0: 0, x1: 0, xRange: 0,
			y0: 0, y1: 0, yRange: 0
		};
		this.value = {
			prev: [-1, -1],
			current: [options.x || 0, options.y || 0],
			target: [options.x || 0, options.y || 0]
		};
		this.offset = {
			wrapper: [0, 0],
			mouse: [0, 0],
			prev: [-999999, -999999],
			current: [0, 0],
			target: [0, 0]
		};
		this.change = [0, 0];
		
		this.activity = false;
		this.dragging = false;
		this.tapping = false;
	},
	getOption: function(name, defaultValue)
	{
		return this.options[name] !== undefined ? this.options[name] : defaultValue;
	},
	setup: function()
	{
		this.setWrapperOffset();
		this.setBoundsPadding();
		this.setBounds();
		this.setSteps();
		
		this.addListeners();
	},
	setWrapperOffset: function()
	{
		this.offset.wrapper = Position.get(this.wrapper);
	},
	setBoundsPadding: function()
	{
		if(!this.bounds.left && !this.bounds.right)
		{
			this.bounds.left = Position.get(this.handle)[0] - this.offset.wrapper[0];
			this.bounds.right = -this.bounds.left;
		}
		if(!this.bounds.top && !this.bounds.bottom)
		{
			this.bounds.top = Position.get(this.handle)[1] - this.offset.wrapper[1];
			this.bounds.bottom = -this.bounds.top;
		}
	},
	setBounds: function()
	{
		this.bounds.x0 = this.bounds.left;
		this.bounds.x1 = this.wrapper.offsetWidth + this.bounds.right;
		this.bounds.xRange = (this.bounds.x1 - this.bounds.x0) - this.handle.offsetWidth;
		
		this.bounds.y0 = this.bounds.top;
		this.bounds.y1 = this.wrapper.offsetHeight + this.bounds.bottom;
		this.bounds.yRange = (this.bounds.y1 - this.bounds.y0) - this.handle.offsetHeight;
		
		this.bounds.xStep = 1 / (this.xPrecision || Math.max(this.wrapper.offsetWidth, this.handle.offsetWidth));
		this.bounds.yStep = 1 / (this.yPrecision || Math.max(this.wrapper.offsetHeight, this.handle.offsetHeight));
	},
	setSteps: function()
	{
		if(this.steps > 1)
		{
			this.stepRatios = [];
			for(var i = 0; i <= this.steps - 1; i++)
			{
				this.stepRatios[i] = i / (this.steps - 1);
			}
		}
	},
	addListeners: function()
	{
		var self = this;
		
		this.wrapper.onselectstart = function()
		{
			return false;
		}
		this.handle.onmousedown = this.handle.ontouchstart = function(e)
		{
			self.handleDownHandler(e);
		};
		this.wrapper.onmousedown = this.wrapper.ontouchstart = function(e)
		{
			self.wrapperDownHandler(e);
		};
		var mouseUpHandler = document.onmouseup || function(){};
		document.onmouseup = function(e)
		{
			mouseUpHandler(e);
			self.documentUpHandler(e);
		};
		var touchEndHandler = document.ontouchend || function(){};
		document.ontouchend = function(e)
		{
			touchEndHandler(e);
			self.documentUpHandler(e);
		};
		var resizeHandler = window.onresize || function(){};
		window.onresize = function(e)
		{
			resizeHandler(e);
			self.documentResizeHandler(e);
		};
		this.wrapper.onmousemove = function(e)
		{
			self.activity = true;
		}
		this.wrapper.onclick = function(e)
		{
			return !self.activity;
		}
		
		this.interval = setInterval(function(){ self.animate() }, 25);
		self.animate(false, true);
	},
	handleDownHandler: function(e)
	{
		this.activity = false;
		Cursor.refresh(e);
		
		this.preventDefaults(e, true);
		this.startDrag();
		this.cancelEvent(e);
	},
	wrapperDownHandler: function(e)
	{
		Cursor.refresh(e);
		
		this.preventDefaults(e, true);
		this.startTap();
	},
	documentUpHandler: function(e)
	{
		this.stopDrag();
		this.stopTap();
		//this.cancelEvent(e);
	},
	documentResizeHandler: function(e)
	{
		this.setWrapperOffset();
		this.setBounds();
		
		this.update();
	},
	enable: function()
	{
		this.disabled = false;
		this.handle.className = this.handle.className.replace(/\s?disabled/g, '');
	},
	disable: function()
	{
		this.disabled = true;
		this.handle.className += ' disabled';
	},
	setStep: function(x, y, snap)
	{
		this.setValue(
			this.steps && x > 1 ? (x - 1) / (this.steps - 1) : 0,
			this.steps && y > 1 ? (y - 1) / (this.steps - 1) : 0,
			snap
		);
	},
	setValue: function(x, y, snap)
	{
		this.setTargetValue([x, y || 0]);
		if(snap)
		{
			this.groupCopy(this.value.current, this.value.target);
		}
	},
	startTap: function(target)
	{
		if(this.disabled)
		{
			return;
		}
		this.tapping = true;

		this.setWrapperOffset();
		this.setBounds();

		if(target === undefined)
		{
			target = [
				Cursor.x - this.offset.wrapper[0] - (this.handle.offsetWidth / 2),
				Cursor.y - this.offset.wrapper[1] - (this.handle.offsetHeight / 2)
			];
		}
		this.setTargetOffset(target);
	},
	stopTap: function()
	{
		if(this.disabled || !this.tapping)
		{
			return;
		}
		this.tapping = false;
		
		this.setTargetValue(this.value.current);
		this.result();
	},
	startDrag: function()
	{
		if(this.disabled)
		{
			return;
		}

		this.setWrapperOffset();
		this.setBounds();

		this.offset.mouse = [
			Cursor.x - Position.get(this.handle)[0],
			Cursor.y - Position.get(this.handle)[1]
		];
		
		this.dragging = true;
	},
	stopDrag: function()
	{
		if(this.disabled || !this.dragging)
		{
			return;
		}
		this.dragging = false;
		
		var target = this.groupClone(this.value.current);
		if(this.slide)
		{
			var ratioChange = this.change;
			target[0] += ratioChange[0] * 4;
			target[1] += ratioChange[1] * 4;
		}
		this.setTargetValue(target);
		this.result();
	},
	feedback: function()
	{
		var value = this.value.current;
		if(this.snap && this.steps > 1)
		{
			value = this.getClosestSteps(value);
		}
		if(!this.groupCompare(value, this.value.prev))
		{
			if(typeof(this.animationCallback) == 'function')
			{
				this.animationCallback(value[0], value[1]);
			}
			this.groupCopy(this.value.prev, value);
		}
	},
	result: function()
	{
		if(typeof(this.callback) == 'function')
		{
			this.callback(this.value.target[0], this.value.target[1]);
		}
	},
	animate: function(direct, first)
	{
		if(direct && !this.dragging)
		{
			return;
		}
		if(this.dragging)
		{
			var prevTarget = this.groupClone(this.value.target);
			
			var offset = [
				Cursor.x - this.offset.wrapper[0] - this.offset.mouse[0],
				Cursor.y - this.offset.wrapper[1] - this.offset.mouse[1]
			];
			this.setTargetOffset(offset, this.loose);
			
			this.change = [
				this.value.target[0] - prevTarget[0],
				this.value.target[1] - prevTarget[1]
			];
		}
		if(this.dragging || first)
		{
			this.groupCopy(this.value.current, this.value.target);
		}
		if(this.dragging || this.glide() || first)
		{
			this.update();
			this.feedback();
		}
	},
	glide: function()
	{
		var diff = [
			this.value.target[0] - this.value.current[0],
			this.value.target[1] - this.value.current[1]
		];
		if(!diff[0] && !diff[1])
		{
			return false;
		}
		if(Math.abs(diff[0]) > this.bounds.xStep || Math.abs(diff[1]) > this.bounds.yStep)
		{
			this.value.current[0] += diff[0] * this.speed;
			this.value.current[1] += diff[1] * this.speed;
		}
		else
		{
			this.groupCopy(this.value.current, this.value.target);
		}
		return true;
	},
	update: function()
	{
		if(!this.snap)
		{
			this.offset.current = this.getOffsetsByRatios(this.value.current);
		}
		else
		{
			this.offset.current = this.getOffsetsByRatios(
				this.getClosestSteps(this.value.current)
			);
		}
		this.show();
	},
	show: function()
	{
		if(!this.groupCompare(this.offset.current, this.offset.prev))
		{
			if(this.horizontal)
			{
				this.handle.style.left = String(this.offset.current[0]) + 'px';
			}
			if(this.vertical)
			{
				this.handle.style.top = String(this.offset.current[1]) + 'px';
			}
			this.groupCopy(this.offset.prev, this.offset.current);
		}
	},
	setTargetValue: function(value, loose)
	{
		var target = loose ? this.getLooseValue(value) : this.getProperValue(value);
		
		this.groupCopy(this.value.target, target);
		this.offset.target = this.getOffsetsByRatios(target);
	},
	setTargetOffset: function(offset, loose)
	{
		var value = this.getRatiosByOffsets(offset);
		var target = loose ? this.getLooseValue(value) : this.getProperValue(value);
		
		this.groupCopy(this.value.target, target);
		this.offset.target = this.getOffsetsByRatios(target);
	},
	getLooseValue: function(value)
	{
		var proper = this.getProperValue(value);
		return [
			proper[0] + ((value[0] - proper[0]) / 4),
			proper[1] + ((value[1] - proper[1]) / 4)
		];
	},
	getProperValue: function(value)
	{
		var proper = this.groupClone(value);

		proper[0] = Math.max(proper[0], 0);
		proper[1] = Math.max(proper[1], 0);
		proper[0] = Math.min(proper[0], 1);
		proper[1] = Math.min(proper[1], 1);

		if((!this.dragging && !this.tapping) || this.snap)
		{
			if(this.steps > 1)
			{
				proper = this.getClosestSteps(proper);
			}
		}
		return proper;
	},
	getRatiosByOffsets: function(group)
	{
		return [
			this.getRatioByOffset(group[0], this.bounds.xRange, this.bounds.x0),
			this.getRatioByOffset(group[1], this.bounds.yRange, this.bounds.y0)
		];
	},
	getRatioByOffset: function(offset, range, padding)
	{
		return range ? (offset - padding) / range : 0;
	},
	getOffsetsByRatios: function(group)
	{
		return [
			this.getOffsetByRatio(group[0], this.bounds.xRange, this.bounds.x0),
			this.getOffsetByRatio(group[1], this.bounds.yRange, this.bounds.y0)
		];
	},
	getOffsetByRatio: function(ratio, range, padding)
	{
		return Math.round(ratio * range) + padding;
	},
	getClosestSteps: function(group)
	{
		return [
			this.getClosestStep(group[0]),
			this.getClosestStep(group[1])
		];
	},
	getClosestStep: function(value)
	{
		var k = 0;
		var min = 1;
		for(var i = 0; i <= this.steps - 1; i++)
		{
			if(Math.abs(this.stepRatios[i] - value) < min)
			{
				min = Math.abs(this.stepRatios[i] - value);
				k = i;
			}
		}
		return this.stepRatios[k];
	},
	groupCompare: function(a, b)
	{
		return a[0] == b[0] && a[1] == b[1];
	},
	groupCopy: function(a, b)
	{
		a[0] = b[0];
		a[1] = b[1];
	},
	groupClone: function(a)
	{
		return [a[0], a[1]];
	},
	preventDefaults: function(e, selection)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.preventDefault)
		{
			e.preventDefault();
		}
		e.returnValue = false;
		
		if(selection && document.selection)
		{
			document.selection.empty();
		}
	},
	cancelEvent: function(e)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.stopPropagation)
		{
			e.stopPropagation();
		}
		e.cancelBubble = true;
	}
};

/**
 * jQuery.browser shim that makes Walkontable working with jQuery 1.9+
 */
if (!jQuery.browser) {
  (function () {
    var matched, browser;

    /*
     * Copyright 2011, John Resig
     * Dual licensed under the MIT or GPL Version 2 licenses.
     * http://jquery.org/license
     */
    jQuery.uaMatch = function (ua) {
      ua = ua.toLowerCase();

      var match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
        [];

      return {
        browser: match[ 1 ] || "",
        version: match[ 2 ] || "0"
      };
    };

    matched = jQuery.uaMatch(navigator.userAgent);
    browser = {};

    if (matched.browser) {
      browser[ matched.browser ] = true;
      browser.version = matched.version;
    }

    // Chrome is Webkit, but Webkit is also Safari.
    if (browser.chrome) {
      browser.webkit = true;
    }
    else if (browser.webkit) {
      browser.safari = true;
    }

    jQuery.browser = browser;

  })();
}
/*! Copyright (c) 2013 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.1.3
 *
 * Requires: 1.2.2+
 */

(function (factory) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS style for Browserify
        module.exports = factory;
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    var toFix = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'];
    var toBind = 'onwheel' in document || document.documentMode >= 9 ? ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'];
    var lowestDelta, lowestDeltaXY;

    if ( $.event.fixHooks ) {
        for ( var i = toFix.length; i; ) {
            $.event.fixHooks[ toFix[--i] ] = $.event.mouseHooks;
        }
    }

    $.event.special.mousewheel = {
        setup: function() {
            if ( this.addEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.addEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = handler;
            }
        },

        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.removeEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = null;
            }
        }
    };

    $.fn.extend({
        mousewheel: function(fn) {
            return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
        },

        unmousewheel: function(fn) {
            return this.unbind("mousewheel", fn);
        }
    });


    function handler(event) {
        var orgEvent = event || window.event,
            args = [].slice.call(arguments, 1),
            delta = 0,
            deltaX = 0,
            deltaY = 0,
            absDelta = 0,
            absDeltaXY = 0,
            fn;
        event = $.event.fix(orgEvent);
        event.type = "mousewheel";

        // Old school scrollwheel delta
        if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta; }
        if ( orgEvent.detail )     { delta = orgEvent.detail * -1; }

        // New school wheel delta (wheel event)
        if ( orgEvent.deltaY ) {
            deltaY = orgEvent.deltaY * -1;
            delta  = deltaY;
        }
        if ( orgEvent.deltaX ) {
            deltaX = orgEvent.deltaX;
            delta  = deltaX * -1;
        }

        // Webkit
        if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY; }
        if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = orgEvent.wheelDeltaX * -1; }

        // Look for lowest delta to normalize the delta values
        absDelta = Math.abs(delta);
        if ( !lowestDelta || absDelta < lowestDelta ) { lowestDelta = absDelta; }
        absDeltaXY = Math.max(Math.abs(deltaY), Math.abs(deltaX));
        if ( !lowestDeltaXY || absDeltaXY < lowestDeltaXY ) { lowestDeltaXY = absDeltaXY; }

        // Get a whole value for the deltas
        fn = delta > 0 ? 'floor' : 'ceil';
        delta  = Math[fn](delta / lowestDelta);
        deltaX = Math[fn](deltaX / lowestDeltaXY);
        deltaY = Math[fn](deltaY / lowestDeltaXY);

        // Add event and delta to the front of the arguments
        args.unshift(event, delta, deltaX, deltaY);

        return ($.event.dispatch || $.event.handle).apply(this, args);
    }

}));

})(jQuery, window, Handsontable);

// AMD support if present
if (define && define.amd) {
  define('handsontable', [], Handsontable);
}
