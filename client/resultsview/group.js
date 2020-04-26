'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
Backbone.$ = $;
const Annotation = require('./annotation');

const Elem = require('./element');

const GroupModel = Elem.Model.extend({
    defaults : {
        name: "name",
        title: "(no title)",
        element : {
            elements : [ ]
        },
        error: null,
        status: 'complete',
        options: { },
    },
    initialize: function() {
    }
});

const GroupView = Elem.View.extend({
    initialize: function(data) {

        Elem.View.prototype.initialize.call(this, data);

        if (this.model === null)
            this.model = new GroupModel();

        this.create = data.create;
        this.children = [ ];
        this.mode = data.mode;
        this.devMode = data.devMode;
        this.fmt = data.fmt;

        this.hoTag = '<h'  + (this.level+1) + '>';
        this.hcTag = '</h' + (this.level+1) + '>';

        this.$el.addClass('jmv-results-group');

        if (this.mode === 'text')
            this.$title = $(this.hoTag + '# ' + this.model.attributes.title + this.hcTag).prependTo(this.$el);
        else
            this.$title = $(this.hoTag + this.model.attributes.title + this.hcTag).prependTo(this.$el);
        this.addIndex++;

        this.$container = $('<div class="jmv-results-group-container"></div>');
        this.addContent(this.$container);

        this.render();
    },
    type: function() {
        return 'Group';
    },
    get: function(address) {
        if (address.length === 0)
            return this;

        let childName = address[0];
        let child = null;

        for (let i = 0; i < this.children.length; i++) {
            let nextChild = this.children[i];
            if (nextChild.model.get('name') === childName) {
                child = nextChild;
                break;
            }
        }

        if (child !== null && address.length > 1)
            return child.get(address.slice(1));
        else
            return child;
    },
    render: function() {

        Elem.View.prototype.render.call(this);

        let promises = [ ];
        let elements = this.model.attributes.element.elements;
        let options = this.model.attributes.options;

        this._insertAnnotation(this.address(), this.level, true);

        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];
            if (this.mode === 'rich' && element.name === 'syntax' && element.type === 'preformatted')
                continue;
            if ( ! this.devMode && element.name === 'debug' && element.type === 'preformatted')
                continue;
            if (element.visible === 1 || element.visible === 3)
                continue;

            let $el = $('<div></div>');
            let child = this.create(element, options, $el, this.level+1, this, this.mode, undefined, this.fmt, this.model.attributes.refTable);
            if (child !== null) {
                this.children.push(child);
                $el.appendTo(this.$container);
                $('<br>').appendTo(this.$container);

                if (element.name)
                    this._insertAnnotation(child.address(), this.level, false);

                promises.push(child);
            }
        }

        this.ready = Promise.all(promises);
    },
    _insertAnnotation(path, levelIndex, top) {
        Annotation.attachControl(this.$container[0], path, levelIndex, top);
    },
    _menuOptions(event) {
        if (this.isRoot())
            return [ { label: 'Copy' }, { label: 'Duplicate' }, { label: 'Export' } ];
        else
            return Elem.View.prototype._menuOptions.call(this);
    }
});

module.exports = { Model: GroupModel, View: GroupView };
