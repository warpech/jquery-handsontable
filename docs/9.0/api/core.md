---
title: Core
permalink: /9.0/api/
canonicalUrl: /api/
---

# {{ $frontmatter.title }}

[[toc]]

## Description


After Handsontable is constructed, you can modify the grid behavior using the available public methods.

## How to call methods.

These are 2 equal ways to call a Handsontable method:

```js
// all following examples assume that you constructed Handsontable like this
const hot = new Handsontable(document.getElementById('example1'), options);

// now, to use setDataAtCell method, you can either:
hot.setDataAtCell(0, 0, 'new value');
```

Alternatively, you can call the method using jQuery wrapper (__obsolete__, requires initialization using our jQuery guide
```js
$('#example1').handsontable('setDataAtCell', 0, 0, 'new value');
```


## Members:

### columnIndexMapper
`core.columnIndexMapper : IndexMapper`

Instance of index mapper which is responsible for managing the column indexes.



### isDestroyed
`core.isDestroyed : boolean`

A boolean to tell if the Handsontable has been fully destroyed. This is set to `true`
after `afterDestroy` hook is called.



### rowIndexMapper
`core.rowIndexMapper : IndexMapper`

Instance of index mapper which is responsible for managing the row indexes.


## Functions:

### addHook
`core.addHook(key, callback)`

Adds listener to the specified hook name (only for this Handsontable instance).

**See**: Hooks#add  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Hook name (see [Hooks](./hooks/)). |
| callback | <code>function</code> \| <code>Array</code> | Function or array of functions. |


**Example**  
```js
hot.addHook('beforeInit', myCallback);
```

### addHookOnce
`core.addHookOnce(key, callback)`

Adds listener to specified hook name (only for this Handsontable instance). After the listener is triggered,
it will be automatically removed.

**See**: Hooks#once  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Hook name (see [Hooks](./hooks/)). |
| callback | <code>function</code> \| <code>Array</code> | Function or array of functions. |


**Example**  
```js
hot.addHookOnce('beforeInit', myCallback);
```

### alter
`core.alter(action, index, [amount], [source], [keepEmptyRows])`

Allows altering the table structure by either inserting/removing rows or columns.
This method works with an array data structure only.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| action | <code>string</code> |  | Possible alter operations:  * `'insert_row'`  * `'insert_col'`  * `'remove_row'`  * `'remove_col'`. |
| index | <code>number</code> \| <code>Array.&lt;number&gt;</code> |  | Visual index of the row/column before which the new row/column will be                                inserted/removed or an array of arrays in format `[[index, amount],...]`. |
| [amount] | <code>number</code> | <code>1</code> | `optional` Amount of rows/columns to be inserted or removed. |
| [source] | <code>string</code> |  | `optional` Source indicator. |
| [keepEmptyRows] | <code>boolean</code> |  | `optional` Flag for preventing deletion of empty rows. |


**Example**  
```js
// Insert new row above the row at given visual index.
hot.alter('insert_row', 10);
// Insert 3 new columns before 10th column.
hot.alter('insert_col', 10, 3);
// Remove 2 rows starting from 10th row.
hot.alter('remove_row', 10, 2);
// Remove 5 non-contiquous rows (it removes 3 rows from visual index 1 and 2 rows from visual index 5).
hot.alter('remove_row', [[1, 3], [5, 2]]);
```

### batch
`core.batch(wrappedOperations) ⇒ \*`

It batches the rendering process and index recalculations. The method aggregates
multi-line API calls into a callback and postpones the table rendering process
as well aggregates the table logic changes such as index changes into one call
after which the cache is updated. After the execution of the operations, the
table is rendered, and the cache is updated once. As a result, it improves the
performance of wrapped operations.

**Since**: 8.3.0  

| Param | Type | Description |
| --- | --- | --- |
| wrappedOperations | <code>function</code> | Batched operations wrapped in a function. |


**Returns**: <code>\*</code> - Returns result from the wrappedOperations callback.  
**Example**  
```js
hot.batch(() => {
  hot.alter('insert_row', 5, 45);
  hot.alter('insert_col', 10, 40);
  hot.setDataAtCell(1, 1, 'x');
  hot.setDataAtCell(2, 2, 'c');
  hot.setDataAtCell(3, 3, 'v');
  hot.setDataAtCell(4, 4, 'b');
  hot.setDataAtCell(5, 5, 'n');
  hot.selectCell(0, 0);

  const filters = hot.getPlugin('filters');

  filters.addCondition(2, 'contains', ['3']);
  filters.filter();
  hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });
  // The table will be re-rendered and cache will be recalculated once after executing the callback
});
```

### batchExecution
`core.batchExecution(wrappedOperations, [forceFlushChanges]) ⇒ \*`

The method aggregates multi-line API calls into a callback and postpones the
table execution process. After the execution of the operations, the internal table
cache is recalculated once. As a result, it improves the performance of wrapped
operations. Without batching, a similar case could trigger multiple table cache rebuilds.

**Since**: 8.3.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| wrappedOperations | <code>function</code> |  | Batched operations wrapped in a function. |
| [forceFlushChanges] | <code>boolean</code> | <code>false</code> | `optional` If `true`, the table internal data cache is recalculated after the execution of the batched operations. For nested calls, it can be a desire to recalculate the table after each batch. |


**Returns**: <code>\*</code> - Returns result from the wrappedOperations callback.  
**Example**  
```js
hot.batchExecution(() => {
  const filters = hot.getPlugin('filters');

  filters.addCondition(2, 'contains', ['3']);
  filters.filter();
  hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });
  // The table cache will be recalculated once after executing the callback
});
```

### batchRender
`core.batchRender(wrappedOperations) ⇒ \*`

The method aggregates multi-line API calls into a callback and postpones the
table rendering process. After the execution of the operations, the table is
rendered once. As a result, it improves the performance of wrapped operations.
Without batching, a similar case could trigger multiple table render calls.

**Since**: 8.3.0  

| Param | Type | Description |
| --- | --- | --- |
| wrappedOperations | <code>function</code> | Batched operations wrapped in a function. |


**Returns**: <code>\*</code> - Returns result from the wrappedOperations callback.  
**Example**  
```js
hot.batchRender(() => {
  hot.alter('insert_row', 5, 45);
  hot.alter('insert_col', 10, 40);
  hot.setDataAtCell(1, 1, 'John');
  hot.setDataAtCell(2, 2, 'Mark');
  hot.setDataAtCell(3, 3, 'Ann');
  hot.setDataAtCell(4, 4, 'Sophia');
  hot.setDataAtCell(5, 5, 'Mia');
  hot.selectCell(0, 0);
  // The table will be rendered once after executing the callback
});
```

### clear
`core.clear()`

Clears the data from the table (the table settings remain intact).



### colToProp
`core.colToProp(column) ⇒ string | number`

Returns the property name that corresponds with the given column index.
If the data source is an array of arrays, it returns the columns index.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>string</code> \| <code>number</code> - Column property or physical column index.  

### countCols
`core.countCols() ⇒ number`

Returns the total number of visible columns in the table.


**Returns**: <code>number</code> - Total number of columns.  

### countEmptyCols
`core.countEmptyCols([ending]) ⇒ number`

Returns the number of empty columns. If the optional ending parameter is `true`, returns the number of empty
columns at right hand edge of the table.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [ending] | <code>boolean</code> | <code>false</code> | `optional` If `true`, will only count empty columns at the end of the data source row. |


**Returns**: <code>number</code> - Count empty cols.  

### countEmptyRows
`core.countEmptyRows([ending]) ⇒ number`

Returns the number of empty rows. If the optional ending parameter is `true`, returns the
number of empty rows at the bottom of the table.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [ending] | <code>boolean</code> | <code>false</code> | `optional` If `true`, will only count empty rows at the end of the data source. |


**Returns**: <code>number</code> - Count empty rows.  

### countRenderedCols
`core.countRenderedCols() ⇒ number`

Returns the number of rendered columns (including columns partially or fully rendered outside viewport).


**Returns**: <code>number</code> - Returns -1 if table is not visible.  

### countRenderedRows
`core.countRenderedRows() ⇒ number`

Returns the number of rendered rows (including rows partially or fully rendered outside viewport).


**Returns**: <code>number</code> - Returns -1 if table is not visible.  

### countRows
`core.countRows() ⇒ number`

Returns the total number of visual rows in the table.


**Returns**: <code>number</code> - Total number of rows.  

### countSourceCols
`core.countSourceCols() ⇒ number`

Returns the total number of columns in the data source.


**Returns**: <code>number</code> - Total number of columns.  

### countSourceRows
`core.countSourceRows() ⇒ number`

Returns the total number of rows in the data source.


**Returns**: <code>number</code> - Total number of rows.  

### countVisibleCols
`core.countVisibleCols() ⇒ number`

Returns the number of visible columns. Returns -1 if table is not visible.


**Returns**: <code>number</code> - Number of visible columns or -1.  

### countVisibleRows
`core.countVisibleRows() ⇒ number`

Returns the number of visible rows (rendered rows that fully fit inside viewport).


**Returns**: <code>number</code> - Number of visible rows or -1.  

### deselectCell
`core.deselectCell()`

Deselects the current cell selection on the table.



### destroy
`core.destroy()`

Removes the table from the DOM and destroys the instance of the Handsontable.

**Emits**: <code>Hooks#event:afterDestroy</code>  


### destroyEditor
`core.destroyEditor([revertOriginal], [prepareEditorIfNeeded])`

Destroys the current editor, render the table and prepares the editor of the newly selected cell.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [revertOriginal] | <code>boolean</code> | <code>false</code> | `optional` If `true`, the previous value will be restored. Otherwise, the edited value will be saved. |
| [prepareEditorIfNeeded] | <code>boolean</code> | <code>true</code> | `optional` If `true` the editor under the selected cell will be prepared to open. |



### emptySelectedCells
`core.emptySelectedCells([source])`

Erases content from cells that have been selected in the table.

**Since**: 0.36.0  

| Param | Type | Description |
| --- | --- | --- |
| [source] | <code>string</code> | `optional` String that identifies how this change will be described in the changes array (useful in afterChange or beforeChange callback). Set to 'edit' if left empty. |



### getActiveEditor
`core.getActiveEditor() ⇒ BaseEditor`

Returns the active editor class instance.


**Returns**: <code>BaseEditor</code> - The active editor instance.  

### getCell
`core.getCell(row, column, [topmost]) ⇒ HTMLTableCellElement | null`

Returns a TD element for the given `row` and `column` arguments, if it is rendered on screen.
Returns `null` if the TD is not rendered on screen (probably because that part of the table is not visible).


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| row | <code>number</code> |  | Visual row index. |
| column | <code>number</code> |  | Visual column index. |
| [topmost] | <code>boolean</code> | <code>false</code> | `optional` If set to `true`, it returns the TD element from the topmost overlay. For example, if the wanted cell is in the range of fixed rows, it will return a TD element from the `top` overlay. |


**Returns**: <code>HTMLTableCellElement</code> \| <code>null</code> - The cell's TD element.  

### getCellEditor
`core.getCellEditor(row, column) ⇒ function`

Returns the cell editor class by the provided `row` and `column` arguments.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index or cell meta object (see [Core#getCellMeta](./core/#getcellmeta)). |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>function</code> - The editor class.  
**Example**  
```js
// Get cell editor class using `row` and `column` coordinates.
hot.getCellEditor(1, 1);
// Get cell editor class using cell meta object.
hot.getCellEditor(hot.getCellMeta(1, 1));
```

### getCellMeta
`core.getCellMeta(row, column) ⇒ object`

Returns the cell properties object for the given `row` and `column` coordinates.

**Emits**: <code>Hooks#event:beforeGetCellMeta</code>, <code>Hooks#event:afterGetCellMeta</code>  

| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>object</code> - The cell properties object.  

### getCellMetaAtRow
`core.getCellMetaAtRow(row) ⇒ Array`

Returns an array of cell meta objects for specified physical row index.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Physical row index. |



### getCellRenderer
`core.getCellRenderer(row, column) ⇒ function`

Returns the cell renderer function by given `row` and `column` arguments.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> \| <code>object</code> | Visual row index or cell meta object (see [Core#getCellMeta](./core/#getcellmeta)). |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>function</code> - The renderer function.  
**Example**  
```js
// Get cell renderer using `row` and `column` coordinates.
hot.getCellRenderer(1, 1);
// Get cell renderer using cell meta object.
hot.getCellRenderer(hot.getCellMeta(1, 1));
```

### getCellsMeta
`core.getCellsMeta() ⇒ Array`

Get all the cells meta settings at least once generated in the table (in order of cell initialization).


**Returns**: <code>Array</code> - Returns an array of ColumnSettings object instances.  

### getCellValidator
`core.getCellValidator(row, column) ⇒ function | RegExp | undefined`

Returns the cell validator by `row` and `column`.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> \| <code>object</code> | Visual row index or cell meta object (see [Core#getCellMeta](./core/#getcellmeta)). |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>function</code> \| <code>RegExp</code> \| <code>undefined</code> - The validator function.  
**Example**  
```js
// Get cell valiator using `row` and `column` coordinates.
hot.getCellValidator(1, 1);
// Get cell valiator using cell meta object.
hot.getCellValidator(hot.getCellMeta(1, 1));
```

### getColHeader
`core.getColHeader([column]) ⇒ Array | string | number`

Returns an array of column headers (in string format, if they are enabled). If param `column` is given, it
returns the header at the given column.

**Emits**: <code>Hooks#event:modifyColHeader</code>  

| Param | Type | Description |
| --- | --- | --- |
| [column] | <code>number</code> | `optional` Visual column index. |


**Returns**: <code>Array</code> \| <code>string</code> \| <code>number</code> - The column header(s).  

### getColWidth
`core.getColWidth(column) ⇒ number`

Returns the width of the requested column.

**Emits**: <code>Hooks#event:modifyColWidth</code>  

| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>number</code> - Column width.  

### getCoords
`core.getCoords(element) ⇒ CellCoords | null`

Returns the coordinates of the cell, provided as a HTML table cell element.


| Param | Type | Description |
| --- | --- | --- |
| element | <code>HTMLTableCellElement</code> | The HTML Element representing the cell. |


**Returns**: <code>CellCoords</code> \| <code>null</code> - Visual coordinates object.  
**Example**  
```js
hot.getCoords(hot.getCell(1, 1));
// it returns CellCoords object instance with props row: 1 and col: 1.
```

### getCopyableData
`core.getCopyableData(row, column) ⇒ string`

Returns the data's copyable value at specified `row` and `column` index.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |



### getCopyableText
`core.getCopyableText(startRow, startCol, endRow, endCol) ⇒ string`

Returns a string value of the selected range. Each column is separated by tab, each row is separated by a new
line character.


| Param | Type | Description |
| --- | --- | --- |
| startRow | <code>number</code> | From visual row index. |
| startCol | <code>number</code> | From visual column index. |
| endRow | <code>number</code> | To visual row index. |
| endCol | <code>number</code> | To visual column index. |



### getData
`core.getData([row], [column], [row2], [column2]) ⇒ Array.<Array>`

Returns the current data object (the same one that was passed by `data` configuration option or `loadData` method,
unless some modifications have been applied (i.e. Sequence of rows/columns was changed, some row/column was skipped).
If that's the case - use the [Core#getSourceData](./core/#getsourcedata) method.).

Optionally you can provide cell range by defining `row`, `column`, `row2`, `column2` to get only a fragment of table data.


| Param | Type | Description |
| --- | --- | --- |
| [row] | <code>number</code> | `optional` From visual row index. |
| [column] | <code>number</code> | `optional` From visual column index. |
| [row2] | <code>number</code> | `optional` To visual row index. |
| [column2] | <code>number</code> | `optional` To visual column index. |


**Returns**: <code>Array.&lt;Array&gt;</code> - Array with the data.  
**Example**  
```js
// Get all data (in order how it is rendered in the table).
hot.getData();
// Get data fragment (from top-left 0, 0 to bottom-right 3, 3).
hot.getData(3, 3);
// Get data fragment (from top-left 2, 1 to bottom-right 3, 3).
hot.getData(2, 1, 3, 3);
```

### getDataAtCell
`core.getDataAtCell(row, column) ⇒ \*`

Returns the cell value at `row`, `column`.

__Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>\*</code> - Data at cell.  

### getDataAtCol
`core.getDataAtCol(column) ⇒ Array`

Returns array of column values from the data source.

__Note__: If columns were reordered or sorted, the currently visible order will be used.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>Array</code> - Array of cell values.  

### getDataAtProp
`core.getDataAtProp(prop) ⇒ Array`

Given the object property name (e.g. `'first.name'` or `'0'`), returns an array of column's values from the table data.
You can also provide a column index as the first argument.


| Param | Type | Description |
| --- | --- | --- |
| prop | <code>string</code> \| <code>number</code> | Property name or physical column index. |


**Returns**: <code>Array</code> - Array of cell values.  

### getDataAtRow
`core.getDataAtRow(row) ⇒ Array`

Returns a single row of the data.

__Note__: If rows were reordered, sorted or trimmed, the currently visible order will be used.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |


**Returns**: <code>Array</code> - Array of row's cell data.  

### getDataAtRowProp
`core.getDataAtRowProp(row, prop) ⇒ \*`

Returns value at visual `row` and `prop` indexes.

__Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| prop | <code>string</code> | Property name. |


**Returns**: <code>\*</code> - Cell value.  

### getDataType
`core.getDataType(rowFrom, columnFrom, rowTo, columnTo) ⇒ string`

Returns a data type defined in the Handsontable settings under the `type` key ([Options#type](https://handsontable.com/docs/Options.html#type)).
If there are cells with different types in the selected range, it returns `'mixed'`.

__Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.


| Param | Type | Description |
| --- | --- | --- |
| rowFrom | <code>number</code> | From visual row index. |
| columnFrom | <code>number</code> | From visual column index. |
| rowTo | <code>number</code> | To visual row index. |
| columnTo | <code>number</code> | To visual column index. |


**Returns**: <code>string</code> - Cell type (e.q: `'mixed'`, `'text'`, `'numeric'`, `'autocomplete'`).  

### getInstance
`core.getInstance() ⇒ Handsontable`

Returns the Handsontable instance.


**Returns**: <code>Handsontable</code> - The Handsontable instance.  

### getPlugin
`core.getPlugin(pluginName) ⇒ BasePlugin`

Returns plugin instance by provided its name.


| Param | Type | Description |
| --- | --- | --- |
| pluginName | <code>string</code> | The plugin name. |


**Returns**: <code>BasePlugin</code> - The plugin instance.  

### getRowHeader
`core.getRowHeader([row]) ⇒ Array | string | number`

Returns an array of row headers' values (if they are enabled). If param `row` was given, it returns the header of the given row as a string.

**Emits**: <code>Hooks#event:modifyRowHeader</code>  

| Param | Type | Description |
| --- | --- | --- |
| [row] | <code>number</code> | `optional` Visual row index. |


**Returns**: <code>Array</code> \| <code>string</code> \| <code>number</code> - Array of header values / single header value.  

### getRowHeight
`core.getRowHeight(row) ⇒ number`

Returns the row height.

**Emits**: <code>Hooks#event:modifyRowHeight</code>  

| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |


**Returns**: <code>number</code> - The given row's height.  

### getSchema
`core.getSchema() ⇒ object`

Returns schema provided by constructor settings. If it doesn't exist then it returns the schema based on the data
structure in the first row.


**Returns**: <code>object</code> - Schema object.  

### getSelected
`core.getSelected() ⇒ Array.<Array> | undefined`

Returns indexes of the currently selected cells as an array of arrays `[[startRow, startCol, endRow, endCol],...]`.

Start row and start column are the coordinates of the active cell (where the selection was started).

The version 0.36.0 adds a non-consecutive selection feature. Since this version, the method returns an array of arrays.
Additionally to collect the coordinates of the currently selected area (as it was previously done by the method)
you need to use `getSelectedLast` method.


**Returns**: <code>Array.&lt;Array&gt;</code> \| <code>undefined</code> - An array of arrays of the selection's coordinates.  

### getSelectedLast
`core.getSelectedLast() ⇒ Array | undefined`

Returns the last coordinates applied to the table as a an array `[startRow, startCol, endRow, endCol]`.

**Since**: 0.36.0  

**Returns**: <code>Array</code> \| <code>undefined</code> - An array of the selection's coordinates.  

### getSelectedRange
`core.getSelectedRange() ⇒ Array.<CellRange> | undefined`

Returns the current selection as an array of CellRange objects.

The version 0.36.0 adds a non-consecutive selection feature. Since this version, the method returns an array of arrays.
Additionally to collect the coordinates of the currently selected area (as it was previously done by the method)
you need to use `getSelectedRangeLast` method.


**Returns**: <code>Array.&lt;CellRange&gt;</code> \| <code>undefined</code> - Selected range object or undefined if there is no selection.  

### getSelectedRangeLast
`core.getSelectedRangeLast() ⇒ CellRange | undefined`

Returns the last coordinates applied to the table as a CellRange object.

**Since**: 0.36.0  

**Returns**: <code>CellRange</code> \| <code>undefined</code> - Selected range object or undefined` if there is no selection.  

### getSettings
`core.getSettings() ⇒ object`

Returns the object settings.


**Returns**: <code>object</code> - Object containing the current table settings.  

### getSourceData
`core.getSourceData([row], [column], [row2], [column2]) ⇒ Array.<Array> | Array.<object>`

Returns a clone of the source data object.
Optionally you can provide a cell range by using the `row`, `column`, `row2`, `column2` arguments, to get only a
fragment of the table data.

__Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
sorted or trimmed only physical indexes are correct.


| Param | Type | Description |
| --- | --- | --- |
| [row] | <code>number</code> | `optional` From physical row index. |
| [column] | <code>number</code> | `optional` From physical column index (or visual index, if data type is an array of objects). |
| [row2] | <code>number</code> | `optional` To physical row index. |
| [column2] | <code>number</code> | `optional` To physical column index (or visual index, if data type is an array of objects). |


**Returns**: <code>Array.&lt;Array&gt;</code> \| <code>Array.&lt;object&gt;</code> - The table data.  

### getSourceDataArray
`core.getSourceDataArray([row], [column], [row2], [column2]) ⇒ Array`

Returns the source data object as an arrays of arrays format even when source data was provided in another format.
Optionally you can provide a cell range by using the `row`, `column`, `row2`, `column2` arguments, to get only a
fragment of the table data.

__Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
sorted or trimmed only physical indexes are correct.


| Param | Type | Description |
| --- | --- | --- |
| [row] | <code>number</code> | `optional` From physical row index. |
| [column] | <code>number</code> | `optional` From physical column index (or visual index, if data type is an array of objects). |
| [row2] | <code>number</code> | `optional` To physical row index. |
| [column2] | <code>number</code> | `optional` To physical column index (or visual index, if data type is an array of objects). |


**Returns**: <code>Array</code> - An array of arrays.  

### getSourceDataAtCell
`core.getSourceDataAtCell(row, column) ⇒ \*`

Returns a single value from the data source.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Physical row index. |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>\*</code> - Cell data.  

### getSourceDataAtCol
`core.getSourceDataAtCol(column) ⇒ Array`

Returns an array of column values from the data source.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>Array</code> - Array of the column's cell values.  

### getSourceDataAtRow
`core.getSourceDataAtRow(row) ⇒ Array | object`

Returns a single row of the data (array or object, depending on what data format you use).

__Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
sorted or trimmed only physical indexes are correct.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Physical row index. |


**Returns**: <code>Array</code> \| <code>object</code> - Single row of data.  

### getTranslatedPhrase
`core.getTranslatedPhrase(dictionaryKey, extraArguments) ⇒ string`

Get language phrase for specified dictionary key.

**Since**: 0.35.0  

| Param | Type | Description |
| --- | --- | --- |
| dictionaryKey | <code>string</code> | Constant which is dictionary key. |
| extraArguments | <code>\*</code> | Arguments which will be handled by formatters. |



### getValue
`core.getValue() ⇒ \*`

Get value from the selected cell.


**Returns**: <code>\*</code> - Value of selected cell.  

### hasColHeaders
`core.hasColHeaders() ⇒ boolean`

Returns information about if this table is configured to display column headers.


**Returns**: <code>boolean</code> - `true` if the instance has the column headers enabled, `false` otherwise.  

### hasHook
`core.hasHook(key) ⇒ boolean`

Check if for a specified hook name there are added listeners (only for this Handsontable instance). All available
hooks you will find [Hooks](./hooks/).

**See**: Hooks#has  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Hook name. |


**Example**  
```js
const hasBeforeInitListeners = hot.hasHook('beforeInit');
```

### hasRowHeaders
`core.hasRowHeaders() ⇒ boolean`

Returns information about if this table is configured to display row headers.


**Returns**: <code>boolean</code> - `true` if the instance has the row headers enabled, `false` otherwise.  

### isColumnModificationAllowed
`core.isColumnModificationAllowed() ⇒ boolean`

Checks if the data format and config allows user to modify the column structure.



### isEmptyCol
`core.isEmptyCol(column) ⇒ boolean`

Check if all cells in the the column declared by the `column` argument are empty.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Column index. |


**Returns**: <code>boolean</code> - `true` if the column at the given `col` is empty, `false` otherwise.  

### isEmptyRow
`core.isEmptyRow(row) ⇒ boolean`

Check if all cells in the row declared by the `row` argument are empty.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |


**Returns**: <code>boolean</code> - `true` if the row at the given `row` is empty, `false` otherwise.  

### isExecutionSuspended
`core.isExecutionSuspended() ⇒ boolean`

Checks if the table indexes recalculation process was suspended. See explanation
in [Core#suspendExecution](./core/#suspendexecution).

**Since**: 8.3.0  


### isListening
`core.isListening() ⇒ boolean`

Returns `true` if the current Handsontable instance is listening to keyboard input on document body.


**Returns**: <code>boolean</code> - `true` if the instance is listening, `false` otherwise.  

### isRenderSuspended
`core.isRenderSuspended() ⇒ boolean`

Checks if the table rendering process was suspended. See explanation in [Core#suspendRender](./core/#suspendrender).

**Since**: 8.3.0  


### listen
`core.listen()`

Listen to the keyboard input on document body. This allows Handsontable to capture keyboard events and respond
in the right way.

**Emits**: <code>Hooks#event:afterListen</code>  


### loadData
`core.loadData(data)`

Loads new data to Handsontable. Loading new data resets the cell meta.
Since 8.0.0 loading new data also resets states corresponding to rows and columns
(for example, row/column sequence, column width, row height, frozen columns etc.).

**Emits**: <code>Hooks#event:beforeLoadData</code>, <code>Hooks#event:afterLoadData</code>, <code>Hooks#event:afterChange</code>  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array</code> | Array of arrays or array of objects containing data. |



### populateFromArray
`core.populateFromArray(row, column, input, [endRow], [endCol], [source], [method], direction, deltas) ⇒ object | undefined`

Populate cells at position with 2D input array (e.g. `[[1, 2], [3, 4]]`). Use `endRow`, `endCol` when you
want to cut input when a certain row is reached.

Optional `method` argument has the same effect as pasteMode option (see [Options#pasteMode](./options/#pastemode)).


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| row | <code>number</code> |  | Start visual row index. |
| column | <code>number</code> |  | Start visual column index. |
| input | <code>Array</code> |  | 2d array. |
| [endRow] | <code>number</code> |  | `optional` End visual row index (use when you want to cut input when certain row is reached). |
| [endCol] | <code>number</code> |  | `optional` End visual column index (use when you want to cut input when certain column is reached). |
| [source] | <code>string</code> | <code>&quot;populateFromArray&quot;</code> | `optional` Used to identify this call in the resulting events (beforeChange, afterChange). |
| [method] | <code>string</code> | <code>&quot;overwrite&quot;</code> | `optional` Populate method, possible values: `'shift_down'`, `'shift_right'`, `'overwrite'`. |
| direction | <code>string</code> |  | Populate direction, possible values: `'left'`, `'right'`, `'up'`, `'down'`. |
| deltas | <code>Array</code> |  | The deltas array. A difference between values of adjacent cells.                       Useful **only** when the type of handled cells is `numeric`. |


**Returns**: <code>object</code> \| <code>undefined</code> - Ending td in pasted area (only if any cell was changed).  

### propToCol
`core.propToCol(prop) ⇒ number`

Returns column index that corresponds with the given property.


| Param | Type | Description |
| --- | --- | --- |
| prop | <code>string</code> \| <code>number</code> | Property name or physical column index. |


**Returns**: <code>number</code> - Visual column index.  

### refreshDimensions
`core.refreshDimensions()`

Updates dimensions of the table. The method compares previous dimensions with the current ones and updates accordingly.

**Emits**: <code>Hooks#event:beforeRefreshDimensions</code>, <code>Hooks#event:afterRefreshDimensions</code>  


### removeCellMeta
`core.removeCellMeta(row, column, key)`

Remove a property defined by the `key` argument from the cell meta object for the provided `row` and `column` coordinates.

**Emits**: <code>Hooks#event:beforeRemoveCellMeta</code>, <code>Hooks#event:afterRemoveCellMeta</code>  

| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |
| key | <code>string</code> | Property name. |



### removeHook
`core.removeHook(key, callback)`

Removes the hook listener previously registered with [Core#addHook](./core/#addhook).

**See**: Hooks#remove  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Hook name. |
| callback | <code>function</code> | Reference to the function which has been registered using [Core#addHook](./core/#addhook). |


**Example**  
```js
hot.removeHook('beforeInit', myCallback);
```

### render
`core.render()`

Rerender the table. Calling this method starts the process of recalculating, redrawing and applying the changes
to the DOM. While rendering the table all cell renderers are recalled.

Calling this method manually is not recommended. Handsontable tries to render itself by choosing the most
optimal moments in its lifecycle.



### resumeExecution
`core.resumeExecution([forceFlushChanges])`

Resumes the execution process. In combination with the [Core#suspendExecution](./core/#suspendexecution)
method it allows aggregating the table logic changes after which the cache is
updated. Resuming the state automatically invokes the table cache updating process.

The method is intended to be used by advanced users. Suspending the execution
process could cause visual glitches caused by not updated the internal table cache.

**Since**: 8.3.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [forceFlushChanges] | <code>boolean</code> | <code>false</code> | `optional` If `true`, the table internal data cache is recalculated after the execution of the batched operations. For nested [Core#batchExecution](./core/#batchexecution) calls, it can be desire to recalculate the table after each batch. |


**Example**  
```js
hot.suspendExecution();
const filters = hot.getPlugin('filters');

filters.addCondition(2, 'contains', ['3']);
filters.filter();
hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });
hot.resumeExecution(); // It updates the cache internally
```

### resumeRender
`core.resumeRender()`

Resumes the rendering process. In combination with the [Core#suspendRender](./core/#suspendrender)
method it allows aggregating the table render cycles triggered by API calls or UI
actions (or both) and calls the "render" once in the end. When the table is in
the suspend state, most operations will have no visual effect until the rendering
state is resumed. Resuming the state automatically invokes the table rendering.

The method is intended to be used by advanced users. Suspending the rendering
process could cause visual glitches when wrongly implemented.

**Since**: 8.3.0  

**Example**  
```js
hot.suspendRender();
hot.alter('insert_row', 5, 45);
hot.alter('insert_col', 10, 40);
hot.setDataAtCell(1, 1, 'John');
hot.setDataAtCell(2, 2, 'Mark');
hot.setDataAtCell(3, 3, 'Ann');
hot.setDataAtCell(4, 4, 'Sophia');
hot.setDataAtCell(5, 5, 'Mia');
hot.selectCell(0, 0);
hot.resumeRender(); // It re-renders the table internally
```

### runHooks
`core.runHooks(key, [p1], [p2], [p3], [p4], [p5], [p6]) ⇒ \*`

Run the callbacks for the hook provided in the `key` argument using the parameters given in the other arguments.

**See**: Hooks#run  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Hook name. |
| [p1] | <code>\*</code> | `optional` Argument passed to the callback. |
| [p2] | <code>\*</code> | `optional` Argument passed to the callback. |
| [p3] | <code>\*</code> | `optional` Argument passed to the callback. |
| [p4] | <code>\*</code> | `optional` Argument passed to the callback. |
| [p5] | <code>\*</code> | `optional` Argument passed to the callback. |
| [p6] | <code>\*</code> | `optional` Argument passed to the callback. |


**Example**  
```js
// Run built-in hook
hot.runHooks('beforeInit');
// Run custom hook
hot.runHooks('customAction', 10, 'foo');
```

### scrollViewportTo
`core.scrollViewportTo([row], [column], [snapToBottom], [snapToRight], [considerHiddenIndexes]) ⇒ boolean`

Scroll viewport to coordinates specified by the `row` and `column` arguments.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [row] | <code>number</code> |  | `optional` Row index. If the last argument isn't defined we treat the index as a visual row index. Otherwise, we are using the index for numbering only this rows which may be rendered (we don't consider hidden rows). |
| [column] | <code>number</code> |  | `optional` Column index. If the last argument isn't defined we treat the index as a visual column index. Otherwise, we are using the index for numbering only this columns which may be rendered (we don't consider hidden columns). |
| [snapToBottom] | <code>boolean</code> | <code>false</code> | `optional` If `true`, viewport is scrolled to show the cell on the bottom of the table. |
| [snapToRight] | <code>boolean</code> | <code>false</code> | `optional` If `true`, viewport is scrolled to show the cell on the right side of the table. |
| [considerHiddenIndexes] | <code>boolean</code> | <code>true</code> | `optional` If `true`, we handle visual indexes, otherwise we handle only indexes which may be rendered when they are in the viewport (we don't consider hidden indexes as they aren't rendered). |


**Returns**: <code>boolean</code> - `true` if scroll was successful, `false` otherwise.  

### selectAll
`core.selectAll([includeHeaders])`

Select the whole table. The previous selection will be overwritten.

**Since**: 0.38.2  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [includeHeaders] | <code>boolean</code> | <code>true</code> | `optional` `true` If the selection should include the row, column and corner headers, `false` otherwise. |



### selectCell
`core.selectCell(row, column, [endRow], [endColumn], [scrollToCell], [changeListener]) ⇒ boolean`

Select cell specified by `row` and `column` values or a range of cells finishing at `endRow`, `endCol`. If the table
was configured to support data column properties that properties can be used to making a selection.

By default, viewport will be scrolled to the selection. After the `selectCell` method had finished, the instance
will be listening to keyboard input on the document.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| row | <code>number</code> |  | Visual row index. |
| column | <code>number</code> \| <code>string</code> |  | Visual column index or column property. |
| [endRow] | <code>number</code> |  | `optional` Visual end row index (if selecting a range). |
| [endColumn] | <code>number</code> \| <code>string</code> |  | `optional` Visual end column index or column property (if selecting a range). |
| [scrollToCell] | <code>boolean</code> | <code>true</code> | `optional` If `true`, the viewport will be scrolled to the selection. |
| [changeListener] | <code>boolean</code> | <code>true</code> | `optional` If `false`, Handsontable will not change keyboard events listener to himself. |


**Returns**: <code>boolean</code> - `true` if selection was successful, `false` otherwise.  
**Example**  
```js
// select a single cell
hot.selectCell(2, 4);
// select a single cell using column property
hot.selectCell(2, 'address');
// select a range of cells
hot.selectCell(2, 4, 3, 5);
// select a range of cells using column properties
hot.selectCell(2, 'address', 3, 'phone_number');
// select a range of cells without scrolling to them
hot.selectCell(2, 'address', 3, 'phone_number', false);
```

### selectCells
`core.selectCells(coords, [scrollToCell], [changeListener]) ⇒ boolean`

Make multiple, non-contiguous selection specified by `row` and `column` values or a range of cells
finishing at `endRow`, `endColumn`. The method supports two input formats which are the same as that
produces by `getSelected` and `getSelectedRange` methods.

By default, viewport will be scrolled to selection. After the `selectCells` method had finished, the instance
will be listening to keyboard input on the document.

**Since**: 0.38.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| coords | <code>Array.&lt;Array&gt;</code> \| <code>Array.&lt;CellRange&gt;</code> |  | Visual coords passed as an array of array (`[[rowStart, columnStart, rowEnd, columnEnd], ...]`)                                     the same format as `getSelected` method returns or as an CellRange objects                                     which is the same format what `getSelectedRange` method returns. |
| [scrollToCell] | <code>boolean</code> | <code>true</code> | `optional` If `true`, the viewport will be scrolled to the selection. |
| [changeListener] | <code>boolean</code> | <code>true</code> | `optional` If `false`, Handsontable will not change keyboard events listener to himself. |


**Returns**: <code>boolean</code> - `true` if selection was successful, `false` otherwise.  
**Example**  
```js
// Using an array of arrays.
hot.selectCells([[1, 1, 2, 2], [3, 3], [6, 2, 0, 2]]);
// Using an array of arrays with defined columns as props.
hot.selectCells([[1, 'id', 2, 'first_name'], [3, 'full_name'], [6, 'last_name', 0, 'first_name']]);
// Using an array of CellRange objects (produced by `.getSelectedRange()` method).
const selected = hot.getSelectedRange();

selected[0].from.row = 0;
selected[0].from.col = 0;

hot.selectCells(selected);
```

### selectColumns
`core.selectColumns(startColumn, [endColumn]) ⇒ boolean`

Select column specified by `startColumn` visual index, column property or a range of columns finishing at `endColumn`.

**Since**: 0.38.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startColumn | <code>number</code> |  | The visual column index from which the selection starts. |
| [endColumn] | <code>number</code> | <code>startColumn</code> | `optional` The visual column index to which the selection finishes. If `endColumn`                                         is not defined the column defined by `startColumn` will be selected. |


**Returns**: <code>boolean</code> - `true` if selection was successful, `false` otherwise.  
**Example**  
```js
// Select column using visual index.
hot.selectColumns(1);
// Select column using column property.
hot.selectColumns('id');
// Select range of columns using visual indexes.
hot.selectColumns(1, 4);
// Select range of columns using column properties.
hot.selectColumns('id', 'last_name');
```

### selectRows
`core.selectRows(startRow, [endRow]) ⇒ boolean`

Select row specified by `startRow` visual index or a range of rows finishing at `endRow`.

**Since**: 0.38.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startRow | <code>number</code> |  | The visual row index from which the selection starts. |
| [endRow] | <code>number</code> | <code>startRow</code> | `optional` The visual row index to which the selection finishes. If `endRow`                                   is not defined the row defined by `startRow` will be selected. |


**Returns**: <code>boolean</code> - `true` if selection was successful, `false` otherwise.  
**Example**  
```js
// Select row using visual index.
hot.selectRows(1);
// Select range of rows using visual indexes.
hot.selectRows(1, 4);
```

### setCellMeta
`core.setCellMeta(row, column, key, value)`

Sets a property defined by the `key` property to the meta object of a cell corresponding to params `row` and `column`.

**Emits**: <code>Hooks#event:beforeSetCellMeta</code>, <code>Hooks#event:afterSetCellMeta</code>  

| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |
| key | <code>string</code> | Property name. |
| value | <code>string</code> | Property value. |



### setCellMetaObject
`core.setCellMetaObject(row, column, prop)`

Set cell meta data object defined by `prop` to the corresponding params `row` and `column`.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |
| column | <code>number</code> | Visual column index. |
| prop | <code>object</code> | Meta object. |



### setDataAtCell
`core.setDataAtCell(row, [column], [value], [source])`

Set new value to a cell. To change many cells at once (recommended way), pass an array of `changes` in format
`[[row, col, value],...]` as the first argument.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> \| <code>Array</code> | Visual row index or array of changes in format `[[row, col, value],...]`. |
| [column] | <code>number</code> | `optional` Visual column index. |
| [value] | <code>string</code> | `optional` New value. |
| [source] | <code>string</code> | `optional` String that identifies how this change will be described in the changes array (useful in afterChange or beforeChange callback). Set to 'edit' if left empty. |



### setDataAtRowProp
`core.setDataAtRowProp(row, prop, value, [source])`

Set new value to a cell. To change many cells at once (recommended way), pass an array of `changes` in format
`[[row, prop, value],...]` as the first argument.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> \| <code>Array</code> | Visual row index or array of changes in format `[[row, prop, value], ...]`. |
| prop | <code>string</code> | Property name or the source string (e.g. `'first.name'` or `'0'`). |
| value | <code>string</code> | Value to be set. |
| [source] | <code>string</code> | `optional` String that identifies how this change will be described in changes array (useful in onChange callback). |



### setSourceDataAtCell
`core.setSourceDataAtCell(row, column, value, [source])`

Set the provided value in the source data set at the provided coordinates.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> \| <code>Array</code> | Physical row index or array of changes in format `[[row, prop, value], ...]`. |
| column | <code>number</code> \| <code>string</code> | Physical column index / prop name. |
| value | <code>\*</code> | The value to be set at the provided coordinates. |
| [source] | <code>string</code> | `optional` Source of the change as a string. |



### spliceCellsMeta
`core.spliceCellsMeta(visualIndex, [deleteAmount], [...cellMetaRows])`

Removes or adds one or more rows of the cell meta objects to the cell meta collections.

**Since**: 0.30.0  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| visualIndex | <code>number</code> |  | A visual index that specifies at what position to add/remove items. |
| [deleteAmount] | <code>number</code> | <code>0</code> | `optional` The number of items to be removed. If set to 0, no cell meta objects will be removed. |
| [...cellMetaRows] | <code>object</code> |  | `optional` The new cell meta row objects to be added to the cell meta collection. |



### spliceCol
`core.spliceCol(column, index, amount, [...elements]) ⇒ Array`

Adds/removes data from the column. This method works the same as Array.splice for arrays.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Index of the column in which do you want to do splice. |
| index | <code>number</code> | Index at which to start changing the array. If negative, will begin that many elements from the end. |
| amount | <code>number</code> | An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed. |
| [...elements] | <code>number</code> | `optional` The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array. |


**Returns**: <code>Array</code> - Returns removed portion of columns.  

### spliceRow
`core.spliceRow(row, index, amount, [...elements]) ⇒ Array`

Adds/removes data from the row. This method works the same as Array.splice for arrays.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Index of column in which do you want to do splice. |
| index | <code>number</code> | Index at which to start changing the array. If negative, will begin that many elements from the end. |
| amount | <code>number</code> | An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed. |
| [...elements] | <code>number</code> | `optional` The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array. |


**Returns**: <code>Array</code> - Returns removed portion of rows.  

### suspendExecution
`core.suspendExecution()`

Suspends the execution process. It's helpful to wrap the table logic changes
such as index changes into one call after which the cache is updated. As a result,
it improves the performance of wrapped operations.

The method is intended to be used by advanced users. Suspending the execution
process could cause visual glitches caused by not updated the internal table cache.

**Since**: 8.3.0  

**Example**  
```js
hot.suspendExecution();
const filters = hot.getPlugin('filters');

filters.addCondition(2, 'contains', ['3']);
filters.filter();
hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });
hot.resumeExecution(); // It updates the cache internally
```

### suspendRender
`core.suspendRender()`

Suspends the rendering process. It's helpful to wrap the table render
cycles triggered by API calls or UI actions (or both) and call the "render"
once in the end. As a result, it improves the performance of wrapped operations.
When the table is in the suspend state, most operations will have no visual
effect until the rendering state is resumed. Resuming the state automatically
invokes the table rendering. To make sure that after executing all operations,
the table will be rendered, it's highly recommended to use the [Core#batchRender](./core/#batchrender)
method or [Core#batch](./core/#batch), which additionally aggregates the logic execution
that happens behind the table.

The method is intended to be used by advanced users. Suspending the rendering
process could cause visual glitches when wrongly implemented.

**Since**: 8.3.0  

**Example**  
```js
hot.suspendRender();
hot.alter('insert_row', 5, 45);
hot.alter('insert_col', 10, 40);
hot.setDataAtCell(1, 1, 'John');
hot.setDataAtCell(2, 2, 'Mark');
hot.setDataAtCell(3, 3, 'Ann');
hot.setDataAtCell(4, 4, 'Sophia');
hot.setDataAtCell(5, 5, 'Mia');
hot.selectCell(0, 0);
hot.resumeRender(); // It re-renders the table internally
```

### toHTML
`core.toHTML() ⇒ string`

Converts instance into outerHTML of HTMLTableElement.

**Since**: 7.1.0  


### toPhysicalColumn
`core.toPhysicalColumn(column) ⇒ number`

Translate visual column index into physical.

This method is useful when you want to retrieve physical column index based on a visual index which can be
reordered, moved or trimmed.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Visual column index. |


**Returns**: <code>number</code> - Returns physical column index.  

### toPhysicalRow
`core.toPhysicalRow(row) ⇒ number`

Translate visual row index into physical.

This method is useful when you want to retrieve physical row index based on a visual index which can be
reordered, moved or trimmed.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Visual row index. |


**Returns**: <code>number</code> - Returns physical row index.  

### toTableElement
`core.toTableElement() ⇒ HTMLTableElement`

Converts instance into HTMLTableElement.

**Since**: 7.1.0  


### toVisualColumn
`core.toVisualColumn(column) ⇒ number`

Translate physical column index into visual.

This method is useful when you want to retrieve visual column index which can be reordered, moved or trimmed
based on a physical index.


| Param | Type | Description |
| --- | --- | --- |
| column | <code>number</code> | Physical column index. |


**Returns**: <code>number</code> - Returns visual column index.  

### toVisualRow
`core.toVisualRow(row) ⇒ number`

Translate physical row index into visual.

This method is useful when you want to retrieve visual row index which can be reordered, moved or trimmed
based on a physical index.


| Param | Type | Description |
| --- | --- | --- |
| row | <code>number</code> | Physical row index. |


**Returns**: <code>number</code> - Returns visual row index.  

### unlisten
`core.unlisten()`

Stop listening to keyboard input on the document body. Calling this method makes the Handsontable inactive for
any keyboard events.



### updateSettings
`core.updateSettings(settings, [init])`

Use it if you need to change configuration after initialization. The `settings` argument is an object containing the new
settings, declared the same way as in the initial settings object.

__Note__, that although the `updateSettings` method doesn't overwrite the previously declared settings, it might reset
the settings made post-initialization. (for example - ignore changes made using the columnResize feature).

Since 8.0.0 passing `columns` or `data` inside `settings` objects will result in resetting states corresponding to rows and columns
(for example, row/column sequence, column width, row height, frozen columns etc.).

**Emits**: <code>Hooks#event:afterCellMetaReset</code>, <code>Hooks#event:afterUpdateSettings</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| settings | <code>object</code> |  | New settings object (see [Options](./options/)). |
| [init] | <code>boolean</code> | <code>false</code> | `optional` Internally used for in initialization mode. |


**Example**  
```js
hot.updateSettings({
   contextMenu: true,
   colHeaders: true,
   fixedRowsTop: 2
});
```

### validateCells
`core.validateCells([callback])`

Validates all cells using their validator functions and calls callback when finished.

If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
would equal `true`.


| Param | Type | Description |
| --- | --- | --- |
| [callback] | <code>function</code> | `optional` The callback function. |


**Example**  
```js
hot.validateCells((valid) => {
  if (valid) {
    // ... code for validated cells
  }
})
```

### validateColumns
`core.validateColumns([columns], [callback])`

Validates columns using their validator functions and calls callback when finished.

If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
 would equal `true`.


| Param | Type | Description |
| --- | --- | --- |
| [columns] | <code>Array</code> | `optional` Array of validation target visual columns indexes. |
| [callback] | <code>function</code> | `optional` The callback function. |


**Example**  
```js
hot.validateColumns([3, 4, 5], (valid) => {
  if (valid) {
    // ... code for validated columns
  }
})
```

### validateRows
`core.validateRows([rows], [callback])`

Validates rows using their validator functions and calls callback when finished.

If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
 would equal `true`.


| Param | Type | Description |
| --- | --- | --- |
| [rows] | <code>Array</code> | `optional` Array of validation target visual row indexes. |
| [callback] | <code>function</code> | `optional` The callback function. |


**Example**  
```js
hot.validateRows([3, 4, 5], (valid) => {
  if (valid) {
    // ... code for validated rows
  }
})
```
## Functions:

### done
`validateCell~done(valid, [canBeValidated])`


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| valid | <code>boolean</code> |  | Indicates if the validation was successful. |
| [canBeValidated] | <code>boolean</code> | <code>true</code> | `optional` Flag which controls the validation process. |

