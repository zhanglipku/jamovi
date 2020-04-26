'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
const Quill = require('quill');
window.katex = require('katex');
Backbone.$ = $;

const Elem = require('./element');

var HtmlModel = Elem.Model.extend({
    defaults : {
        name: 'name',
        title: '(no title)',
        element: '(no syntax)',
        error: null,
        status: 'complete',
        stale: false,
        options: { },
    }
});

var HtmlView = Elem.View.extend({
    initialize: function(data) {

        Elem.View.prototype.initialize.call(this, data);

        this.$el.addClass('jmv-results-html');

        if (this.model === null)
            this.model = new HtmlModel();

        let $editorBox = $(`<div class="editor-box">
                            <div id="toolbar"></div>
                            <div class="editor"></div>
                        </div>`);
        this.$el.append($editorBox);

        this.model.set('title', '');
        var toolbarOptions = [
        			  ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        			  ['code-block', 'formula'],
        			  [{ 'header': 2 }],               // custom button values
        			  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        			  [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
        			  [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent

        			  [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        			  [{ 'align': [] }]                                       // remove formatting button
        			];

        let options = {
              modules: {
                toolbar: toolbarOptions
              },
              placeholder: 'Compose an epic...',
              theme: 'snow'
        };
        this.editor = new Quill($editorBox.find('.editor')[0], options);
        let $editor = $editorBox.find('.ql-editor');
        let $toolbar = $editorBox.find('.ql-toolbar');
        let toolbarClicked = false;
        $toolbar.on('mousedown', () => {
            toolbarClicked = true;
        });
        $editor.on('focus', () => {
            $editorBox.removeClass('readonly');
        });
        $editor.on('blur', () => {
            if (toolbarClicked === false)
                $editorBox.addClass('readonly');
            toolbarClicked = false;
        });

        this.$head = $('head');
        this.render();
    },
    type: function() {
        return 'Html';
    },
    render: function() {

        this.$head.find('.module-asset').remove();

        let doc = this.model.attributes.element;
        let promises = [ ];

        for (let ss of doc.stylesheets) {
            let url = 'module/' + ss;
            let promise = this._insertSS(url);
            promises.push(promise);
        }

        for (let script of doc.scripts)
            this.$head.append('<script src="module/' + script + '" class="module-asset"></script>');

        this.ready = Promise.all(promises).then(() => {
            //this.$el.html(doc.content);
            this.$el.find('a[href]').on('click', (event) => this._handleLinkClick(event));
        });
    },
    _editorRender: function() {
        let editor = new Quill(this.$el);
    },
    _handleLinkClick(event) {
        let href = $(event.target).attr('href');
        window.openUrl(href);
    },
    _insertSS(url) {
        return new Promise((resolve) => {
            $.get(url, (data) => {
                this.$head.append('<style class="module-asset">' + data + '</style>');
                resolve(data);
            }, 'text');
        });
    },
});

module.exports = { Model: HtmlModel, View: HtmlView };
