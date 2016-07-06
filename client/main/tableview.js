
'use strict';

var _ = require('underscore');
var $ = require('jquery');
var Backbone = require('backbone');
Backbone.$ = $;

var SilkyView = require('./view');

var determineFormatting = require('../common/formatting').determineFormatting;
var format = require('../common/formatting').format;

var TableView = SilkyView.extend({
    className: "tableview",
    initialize: function() {
        _.bindAll(this, '_dataSetLoaded', 'scrollHandler', 'updateViewRange', 'resizeHandler', 'refreshCells');

        $(window).resize(this.resizeHandler);

        this.$el.on('resized', this.resizeHandler);

        this.model.on('dataSetLoaded', this._dataSetLoaded, this);
        this.model.on('change:cells',  this._updateCells, this);
        this.model.on('cellsChanged', this._cellsChanged, this);

        this.viewport = null;
        this.viewOuterRange = { top: 0, bottom: -1, left: 0, right: -1 };

        this.$el.addClass("silky-tableview");

        var html = '';
        html += '<div class="silky-table-header">';
        html += '    <div class="silky-column-header">&nbsp;</div>';   // padding so we can inspect the height of the table header
        html += '</div>';
        html += '<div class="silky-table-container">';
        html += '    <div class="silky-table-body"></div>';
        html += '</div>';

        this.$el.html(html);
        this.$container = this.$el.find('.silky-table-container');
        this.$header    = this.$el.find('.silky-table-header');
        this.$body      = this.$container.find('.silky-table-body');
        this.$columns   = [ ];

        this.rowHeaderWidth = 32;

        this.$container.on("scroll", this.scrollHandler);

        var self = this;

        Promise.resolve().then(function() {

            return new Promise(function(resolve, reject) {
                setTimeout(resolve, 0);
            });

        }).then(function() {

            self._rowHeight = self.$header.height();  // read and store the row height
            self.$header.empty();  // clear the temporary cell
            self.$header.css('height', self._rowHeight);
            self.$container.css('top', self._rowHeight);
            self.$container.css('height', self.$el.height() - self._rowHeight);
        });
    },
    _dataSetLoaded : function() {

        this.$header.append('<div class="silky-column-header" style="width:' + this.rowHeaderWidth + 'px ; height: ' + (this._rowHeight - 1) + 'px">&nbsp;</div>');

        var columns = this.model.get('columns');
        var left = this.rowHeaderWidth;

        this._lefts = new Array(columns.length);  // store the left co-ordinate for each column

        for (var colNo = 0; colNo < columns.length; colNo++) {
            var column = columns[colNo];
            var width  = column.width;

            var html = '';
            html += '<div class="silky-column-header ' + column.measureType + '" style="left: ' + left + 'px ; width: ' + column.width + 'px ; height: ' + (this._rowHeight - 1) + 'px">';
            html +=     column.name;
            html += '</div>';

            this.$header.append(html);
            this.$body.append('<div class="silky-column ' + column.measureType + '" style="left: ' + left + 'px ; width: ' + column.width + 'px ; "></div>');

            this._lefts[colNo] = left;
            left += width;
        }

        this.$columns = this.$body.children();
        this.$body.css('width',  left);

        var rowCount = this.model.get('rowCount');
        var totalHeight = rowCount * this._rowHeight;
        this.$body.css('height', totalHeight);

        this.$rhColumn = $('<div class="silky-column-row-header" style="left: 0 ; width: ' + this.rowHeaderWidth + 'px ; background-color: pink ;"></div>').appendTo(this.$body);

        this.updateViewRange();

    },
    _updateCells : function() {

        var colOffset = this.model.get('viewport').left;
        var cells = this.model.get('cells');

        for (var colNo = 0; colNo < cells.length; colNo++) {

            var column = cells[colNo];
            var $column = $(this.$columns[colOffset + colNo]);
            var $cells  = $column.children();

            var formatting = determineFormatting(column);

            for (var rowNo = 0; rowNo < column.length; rowNo++) {
                var  cell = column[rowNo];
                var $cell = $($cells[rowNo]);

                if (cell === -2147483648 || (typeof(cell) === 'number' && isNaN(cell)))
                    cell = '';
                else if (typeof(cell) === 'number')
                    cell = format(cell, formatting);

                $cell.text(cell);
            }
        }

    },
    _cellsChanged : function(range) {

        var viewport = this.viewport;

        var colOffset = range.left - viewport.left;
        var rowOffset = range.top - viewport.top;
        var nCols = range.right - range.left + 1;
        var nRows = viewport.bottom - viewport.top + 1;

        var cells = this.model.get("cells");

        for (var colNo = 0; colNo < nCols; colNo++) {

            var column = cells[colOffset + colNo];
            var $column = $(this.$columns[range.left + colNo]);
            var $cells  = $column.children();

            var formatting = determineFormatting(column);

            for (var rowNo = 0; rowNo < nRows; rowNo++) {

                var $cell = $($cells[rowNo]);
                var cell = column[rowNo];

                if (cell === -2147483648 || (typeof(cell) === 'number' && isNaN(cell)))
                    cell = '';
                else if (typeof(cell) === 'number')
                    cell = format(cell, formatting);

                $cell.text(cell);
            }
        }
    },
    scrollHandler : function(evt) {

        if (this.model.get('hasDataSet') === false)
            return;

        var currentViewRange = this.getViewRange();
        if (this.encloses(this.viewOuterRange, currentViewRange) === false)
            this.updateViewRange();

        var left = this.$container.scrollLeft();
        this.$rhColumn.css('left', left);
        this.$header.css('left', -left);
        this.$header.css('width', this.$el.width() + left);
    },
    resizeHandler : function(evt) {

        if (this.model.get('hasDataSet') === false)
            return;

        var currentViewRange = this.getViewRange();
        if (this.encloses(this.viewOuterRange, currentViewRange) === false)
            this.updateViewRange();

        var left = this.$container.scrollLeft();
        this.$header.css('left', -left);
        this.$header.css('width', this.$el.width() + left);
        this.$container.css('height', this.$el.height() - this._rowHeight);
    },
    updateViewRange : function() {

        var v = this.getViewRange();

        var topRow = Math.floor(v.top / this._rowHeight) - 1;
        var botRow = Math.ceil(v.bottom / this._rowHeight) - 1;

        var rowCount = this.model.get('rowCount');
        var columnCount = this.model.get('columnCount');

        var columns = this.model.get("columns");

        var leftColumn  = _.sortedIndex(this._lefts, v.left) - 1;
        var rightColumn = _.sortedIndex(this._lefts, v.right) - 1;

        if (leftColumn > columnCount - 1)
            leftColumn = columnCount - 1;
        if (leftColumn < 0)
            leftColumn = 0;
        if (rightColumn > columnCount - 1)
            rightColumn = columnCount - 1;
        if (rightColumn < 0)
            rightColumn = 0;

        var oTop  = ((topRow + 1) * this._rowHeight);
        var oBot  = ((botRow + 1) * this._rowHeight);
        var oLeft = this._lefts[leftColumn];

        var oRight;
        if (rightColumn == columns.length - 1) // last column
            oRight = Infinity;
        else
            oRight = this._lefts[rightColumn] + columns[rightColumn].width;

        if (botRow > rowCount - 1)
            botRow = rowCount - 1;
        if (botRow < 0)
            botRow = 0;
        if (topRow > rowCount - 1)
            topRow = rowCount - 1;
        if (topRow < 0)
            topRow = 0;

        var oldViewport = this.viewport;

        this.viewRange      = v;
        this.viewOuterRange = { top : oTop,   bottom : oBot,   left : oLeft,      right : oRight };
        this.viewport    = { top : topRow, bottom : botRow, left : leftColumn, right : rightColumn };

        //console.log("view");
        //console.log(this.viewport);
        //console.log(this.viewRange);
        //console.log(this.viewOuterRange);

        this.refreshCells(oldViewport, this.viewport);
    },
    _createCellHTML : function(top, height, content) {
        return '<div class="silky-column-cell" style="top : ' + top + 'px ; height : ' + height + 'px">' + content + '</div>';
    },
    _createRHCellHTML : function(top, height, content) {
        return '<div class="silky-row-header-cell" style="top : ' + top + 'px ; height : ' + height + 'px">' + content + '</div>';
    },
    refreshCells : function(oldViewport, newViewport) {

        var o = oldViewport;
        var n = newViewport;
        var i, j, count;

        var columns = this.model.get('columns');
        var column;
        var $column;
        var $cell, $cells;
        var rowNo, colNo, nRows, nCols;
        var top, left, bottom, right;

        if (o === null || n.top !== o.top || n.bottom !== o.bottom) {

            this.$rhColumn.empty();
            nRows = n.bottom - n.top + 1;

            for (j = 0; j < nRows; j++) {
                rowNo = n.top + j;
                top   = rowNo * this._rowHeight;
                $cell = $(this._createRHCellHTML(top, this._rowHeight, '' + (n.top+j+1)));
                this.$rhColumn.append($cell);
            }
        }

        if (o === null || this.overlaps(o, n) === false) { // entirely new cells

            if (o !== null) {  // clear old cells

                for (i = o.left; i <= o.right; i++) {
                    $column = $(this.$columns[i]);
                    $column.empty();
                }
            }

            nRows = n.bottom - n.top + 1;

            for (i = n.left; i <= n.right; i++) {

                column  = columns[i];
                $column = $(this.$columns[i]);

                for (j = 0; j < nRows; j++) {
                    rowNo = n.top + j;
                    top   = rowNo * this._rowHeight;
                    $cell = $(this._createCellHTML(top, this._rowHeight, ''));
                    $column.append($cell);
                }
            }

            this.model.setViewport(n);
        }
        else {  // add or subtract from cells displayed

            if (n.right > o.right) {  // add columns to the right

                nCols = n.right - o.right;
                nRows = n.bottom - n.top + 1;

                for (i = 0; i < nCols; i++) {

                    colNo = o.right + i + 1;
                    left  = this._lefts[colNo];
                    column = columns[colNo];
                    $column = $(this.$columns[colNo]);

                    for (j = 0; j < nRows; j++) {
                        rowNo = n.top + j;
                        top = this._rowHeight * rowNo;
                        $cell = $(this._createCellHTML(top, this._rowHeight, ''));
                        $column.append($cell);
                    }
                }
            }
            else if (n.right < o.right) {  // delete columns from the right
                nCols = o.right - n.right;
                count = this.$columns.length;
                for (i = 0; i < nCols; i++) {
                    $column = $(this.$columns[o.right - i]);
                    $column.empty();
                }
            }

            if (n.left < o.left) {  // add columns to the left

                nCols = o.left - n.left;
                nRows = n.bottom - n.top + 1;

                for (i = 0; i < nCols; i++) {

                    colNo = n.left + i;
                    left  = this._lefts[colNo];
                    column = columns[colNo];
                    $column = $(this.$columns[colNo]);

                    for (j = 0; j < nRows; j++) {
                        rowNo = n.top + j;
                        top = this._rowHeight * rowNo;
                        $cell = $(this._createCellHTML(top, this._rowHeight, ''));
                        $column.append($cell);
                    }
                }
            }
            else if (n.left > o.left) {  // delete columns from the left
                nCols = n.left - o.left;
                count = this.$columns.length;
                for (i = 0; i < nCols; i++) {
                    $column = $(this.$columns[o.left + i]);
                    $column.empty();
                }
            }

            if (n.bottom > o.bottom) {

                nRows = n.bottom - o.bottom;  // to add rows to the bottom

                left  = Math.max(o.left,  n.left);
                right = Math.min(o.right, n.right);

                for (i = left; i <= right; i++) {

                    column  = columns[i];
                    $column = $(this.$columns[i]);

                    for (j = 0; j < nRows; j++) {
                        rowNo = o.bottom + j + 1;
                        top   = rowNo * this._rowHeight;
                        $cell = $(this._createCellHTML(top, this._rowHeight, ''));
                        $column.append($cell);
                    }
                }
            }

            if (n.bottom < o.bottom) {

                nRows = o.bottom - n.bottom;  // to remove from the bottom

                left  = Math.max(o.left,  n.left);
                right = Math.min(o.right, n.right);

                for (i = left; i <= right; i++) {

                    $column = $(this.$columns[i]);
                    $cells = $column.children();
                    count = $cells.length;

                    for (j = 0; j < nRows; j++)
                        $($cells[count - j - 1]).remove();
                }
            }

            if (n.top < o.top) {

                nRows = o.top - n.top;  // add to top

                left  = Math.max(o.left,  n.left);
                right = Math.min(o.right, n.right);

                for (i = left; i <= right; i++) {

                    column  = columns[i];
                    $column = $(this.$columns[i]);

                    for (j = 0; j < nRows; j++) {
                        rowNo = o.top - j - 1;
                        top   = rowNo * this._rowHeight;
                        $cell = $(this._createCellHTML(top, this._rowHeight, ''));
                        $column.prepend($cell);
                    }
                }
            }

            if (n.top > o.top) {  // remove from the top

                nRows = n.top - o.top;

                left  = Math.max(o.left,  n.left);
                right = Math.min(o.right, n.right);

                for (var c = left; c <= right; c++) {
                    $column = $(this.$columns[c]);
                    $cells = $column.children();
                    for (var r = 0; r < nRows; r++)
                        $($cells[r]).remove();
                }
            }

            var deltaLeft   = o.left - n.left;
            var deltaRight  = n.right - o.right;
            var deltaTop    = o.top - n.top;
            var deltaBottom = n.bottom - o.bottom;

            this.model.reshape(deltaLeft, deltaTop, deltaRight, deltaBottom);
        }
    },
    getViewRange : function() {
        var vTop   = this.$container.scrollTop();
        var vBot   = vTop + this.$el.height() - this._rowHeight;
        var vLeft  = this.$container.scrollLeft();
        var vRight = vLeft + this.$el.width();

        return { top : vTop, bottom : vBot, left : vLeft, right : vRight };
    },
    encloses : function(outer, inner) {
        return outer.left   <= inner.left
            && outer.right  >= inner.right
            && outer.top    <= inner.top
            && outer.bottom >= inner.bottom;
    },
    overlaps : function(one, two) {
        var colOverlap = (one.left >= two.left && one.left <= two.right) || (one.right >= two.left && one.right <= two.right);
        var rowOverlap = (one.top <= two.bottom && one.top >= two.top)  || (one.bottom <= two.bottom && one.bottom >= two.top);
        return rowOverlap && colOverlap;
    }
});

module.exports = TableView;