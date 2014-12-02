(function (Handsontable) {

  'use strict';

  var NumericEditor = Handsontable.editors.TextEditor.prototype.extend();

  NumericEditor.prototype.beginEditing = function (initialValue) {

    var BaseEditor = Handsontable.editors.TextEditor.prototype;

    if (typeof (initialValue) === 'undefined' && this.originalValue) {

      var value = '' + this.originalValue;

      var old_language = numeral.language();
      if (typeof this.cellProperties.language !== 'undefined') {
        numeral.language(this.cellProperties.language)
      }

      var decimalDelimiter = numeral.languageData().delimiters.decimal;
      value = value.replace('.', decimalDelimiter);
      numeral.language(old_language);

      BaseEditor.beginEditing.apply(this, [value]);
    } else {
      BaseEditor.beginEditing.apply(this, arguments);
    }

  };

  Handsontable.editors.NumericEditor = NumericEditor;
  Handsontable.editors.registerEditor('numeric', NumericEditor);

})(Handsontable);
