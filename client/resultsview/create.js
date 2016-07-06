'use strict';

var _ = require('underscore');
var $ = require('jquery');

var TableModel = require('./table').Model;
var TableView  = require('./table').View;
var GroupModel = require('./group').Model;
var GroupView  = require('./group').View;
var ImageModel = require('./image').Model;
var ImageView  = require('./image').View;
var ArrayModel = require('./array').Model;
var ArrayView  = require('./array').View;

var createItem = function(element, $el, level, parent) {

    if (_.isUndefined(level))
        level = 1;

    var model;
    var view;

    if (element.table) {
        model = new TableModel({
            name: element.name,
            title: element.title,
            element: element.table,
            status: element.status,
            error: element.error });
        view = new TableView({ el : $el, model : model, parent : parent });
    }
    else if (element.group) {

        if (element.group.elements.length > 0) {
            model = new GroupModel({
                name: element.name,
                title: element.title,
                element: element.group,
                status: element.status,
                error: element.error });
            view = new GroupView({ el : $el, model : model, create : createItem, level : level, parent : parent });
        }
        else {
            view = null;
        }
    }
    else if (element.image) {
        model = new ImageModel({
            name : element.name,
            title : element.title,
            element : element.image,
            status: element.status,
            error: element.error });
        view = new ImageView({ el : $el, model : model, parent : parent });
    }
    else if (element.array) {

        if (element.array.elements.length > 0) {
            model = new ArrayModel({
                name : element.name,
                title : element.title,
                element : element.array,
                status: element.status,
                error: element.error });
            view = new ArrayView({ el : $el, model : model, create : createItem, level : level, parent : parent });
        }
        else {
            view = null;
        }
    }
    else if (element.text) {
        $el.append(element.text);
    }

    return view;
};

module.exports = { createItem: createItem };