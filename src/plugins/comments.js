(function (Handsontable) {
  'use strict';

  function Comments(instance) {

    var doSaveComment = function (row, col, comment, instance) {
        instance.setCellMeta(row, col, 'comment', comment);
        instance.render();
      },
      saveComment = function (range, comment, instance) {
       //LIKE IN EXCEL (TOP LEFT CELL)
        doSaveComment(range.from.row, range.from.col, comment, instance);
      },
      hideCommentTextArea = function () {
        var commentBox = createCommentBox();
        commentBox.style.display = 'none';
        commentBox.value = '';
      },
      bindMouseEvent = function (range) {

        function commentsListener(event) {
          $(instance.rootElement).off('mouseover.htCommment');
          if (!(event.target.className == 'htCommentTextArea')) {
            var value = document.getElementsByClassName('htCommentTextArea')[0].value;
            if (value.trim().length > 1) {
              saveComment(range, value, instance);
            }
            unBindMouseEvent();
            instance.comments.visible = false;
            hideCommentTextArea();
          }
        }

        $(document).on('mousedown.htCommment', Handsontable.helper.proxy(commentsListener));
      },
      unBindMouseEvent = function () {
        $(document).off('mousedown.htCommment');
        $(instance.rootElement).on('mouseover.htCommment', Handsontable.helper.proxy(commentsMouseOverListener));
      },
      placeCommentBox = function (range, commentBox) {
        var TD = instance.view.wt.wtTable.getCell(range.from),
          offset = Handsontable.Dom.offset(TD),
          lastColWidth = instance.getColWidth(range.from.col);

        commentBox.style.position = 'absolute';
        commentBox.style.left = offset.left + lastColWidth + 'px';
        commentBox.style.top = offset.top + 'px';
        commentBox.style.zIndex = 2;
        bindMouseEvent(range, commentBox);
      },
      createCommentBox = function (value) {
        var comments = document.getElementsByClassName('htComments')[0];

        if (!comments) {
          comments = document.createElement('DIV');

          var textArea = document.createElement('TEXTAREA');
          Handsontable.Dom.addClass(textArea, 'htCommentTextArea');
          comments.appendChild(textArea);

          Handsontable.Dom.addClass(comments, 'htComments');
          document.getElementsByTagName('body')[0].appendChild(comments);
        }

        value = value ||'';

        document.getElementsByClassName('htCommentTextArea')[0].value = value;

        //var tA = document.getElementsByClassName('htCommentTextArea')[0];
        //tA.focus();
        return comments;
      },
      commentsMouseOverListener = function (event) {
          if(event.target.className.indexOf('htCommentCell') != -1) {
              unBindMouseEvent();
              var coords = instance.view.wt.wtTable.getCoords(event.target);
              var range = {
                  from: new WalkontableCellCoords(coords.row, coords.col)
              };

              instance.comments.showComment(range);
          }
          else if(instance.comments.visible){
            if (event.target.className !='htCommentTextArea'){
              console.log('Hide' + instance.guid);
              instance.comments.visible = false;
              hideCommentTextArea();
            }
          }
      };

    return {
      init: function () {
          $(instance.rootElement).on('mouseover.htCommment', Handsontable.helper.proxy(commentsMouseOverListener));
      },
      showComment: function (range) {
        instance.comments.visible = true;
        var meta = instance.getCellMeta(range.from.row, range.from.col),
          value = '';

        if (meta.comment) {
          value = meta.comment;
        }
        var commentBox = createCommentBox(value);
        commentBox.style.display = 'block';
        placeCommentBox(range, commentBox);
      },
      removeComment: function (row, col) {
        instance.removeCellMeta(row, col, 'comment');
        instance.render();
      },
      checkSelectionCommentsConsistency : function () {
        var hasComment = false;
        // IN EXCEL THERE IS COMMENT ONLY FOR TOP LEFT CELL IN SELECTION
        var cell = instance.getSelectedRange().from;

        if(instance.getCellMeta(cell.row,cell.col).comment) {
          hasComment = true;
        }
        return hasComment;
      },
      visible : false


    };
  }


  var init = function () {
      var instance = this;
      var commentsSetting = instance.getSettings().comments;

      if (commentsSetting) {
        if (!instance.comments){
          instance.comments = new Comments(instance);
          instance.comments.init();
        }
      }
    },
    afterRenderer = function (TD, row, col, prop, value, cellProperties) {
      if(cellProperties.comment) {
        Handsontable.Dom.addClass(TD, cellProperties.commentedCellClassName);
      }
    },
    addCommentsActionsToContextMenu = function (defaultOptions) {
      var instance = this;
      if (!instance.getSettings().comments) {
        return;
      }

      defaultOptions.items.push(Handsontable.ContextMenu.SEPARATOR);

      defaultOptions.items.push({
        key: 'commentsAddEdit',
        name: function () {
          var hasComment = instance.comments.checkSelectionCommentsConsistency();
          return hasComment ? "Edit Comment" : "Add Comment";

        },
        callback: function (key, selection, event) {
            instance.comments.showComment(this.getSelectedRange());
        },
        disabled: function () {
          return false;
        }
      });

      defaultOptions.items.push({
        key: 'commentsRemove',
        name: function () {
          return "Delete Comment"
        },
        callback: function (key, selection, event) {
          instance.comments.removeComment(selection.start.row, selection.start.col);
        },
        disabled: function () {
          var hasComment = instance.comments.checkSelectionCommentsConsistency();
          return !hasComment;
        }
      });
    };

  Handsontable.hooks.add('beforeInit', init);
  Handsontable.hooks.add('afterContextMenuDefaultOptions', addCommentsActionsToContextMenu);
  Handsontable.hooks.add('afterRenderer', afterRenderer);
  //$(document).on('mouseover.htCommment', Handsontable.helper.proxy(commentsMouseOverListener));
})(Handsontable);
