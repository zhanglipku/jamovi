'use strict';

const $ = require('jquery');

const host = require('./host');

let Coms = require('./coms');
let coms = new Coms();

const TableView   = require('./tableview');
const ResultsView = require('./results');
const SplitPanel  = require('./splitpanel');
const Backstage   = require('./backstage').View;
const BackstageModel = require('./backstage').Model;
const Ribbon      = require('./ribbon').View;
const RibbonModel = require('./ribbon').Model;
const Notifications = require('./notifications');
const SplitPanelSection = require('./splitpanelsection');
const OptionsPanel = require('./optionspanel');
const VariableEditor = require('./variableeditor');
const ActionHub = require('./actionhub');

const Instance = require('./instance');
const Modules = require('./modules');
const Notify = require('./notification');
const JError = require('./errors').JError;

require('./infobox');

const keyboardJS = require('keyboardjs');

keyboardJS.Keyboard.prototype.pause = function(key) {
    if (this._pausedCounts === undefined)
        this._pausedCounts = { };

    this._pausedCounts[key] = true;

    let count = false;
    for (let name in this._pausedCounts) {
        count = this._pausedCounts[name];
        if (count)
            break;
    }

    if (count === true && this._paused === false) {
        if (this._paused) { return; }
        if (this._locale) { this.releaseAllKeys(); }
        this._paused = true;
    }
};

keyboardJS.Keyboard.prototype.resume = function(key) {
    if (this._pausedCounts === undefined)
        this._pausedCounts = { };

    this._pausedCounts[key] = false;

    let count = false;
    for (let name in this._pausedCounts) {
        count = this._pausedCounts[name];
        if (count)
            break;
    }

    if (count === false && this._paused === true) {
        this._paused = false;
    }
};

let instance = new Instance({ coms : coms });

let dataSetModel = instance.dataSetModel();
let analyses = instance.analyses();

let backstageModel = new BackstageModel({ instance: instance });
let modules = new Modules({ instance: instance });
let ribbonModel = new RibbonModel({ modules: modules, settings: instance.settings() });

let infoBox = document.createElement('jmv-infobox');
infoBox.style.display = 'none';

coms.on('failure', (event) => {
    if (host.isElectron) {
        infoBox.setup({
            title: 'Connection lost',
            message: 'An unexpected error has occured, and jamovi must now close.',
            status: 'terminated',
        });
    }
    else {
        infoBox.setup({
            title: 'Connection lost',
            message: 'Your connection has been lost. Please refresh the page to continue.',
            status: 'disconnected',
        });
    }
    infoBox.style.display = null;
});

coms.on('broadcast', (message) => {

    if (message.instanceId === '' &&
        message.payloadType === '' &&
        message.status === coms.Messages.Status.ERROR) {

        let error = message.error;
        infoBox.setup({
            title: 'Server message',
            message: `${ error.message }\n\n${ error.cause }`,
            status: 'terminated',
        });
        infoBox.style.display = null;
    }
});

if (window.navigator.platform === 'MacIntel') {
    host.constructMenu([
        {
            label: 'jamovi',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'quit' },
            ]
        },
        {
            label: 'File',
            submenu: [
                { role: 'close' },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ]
        },
    ]);
}

// prevent back navigation
history.pushState(null, null, document.URL);
window.addEventListener('popstate', function () {
    history.pushState(null, null, document.URL);
});


$(document).ready(async() => {

    if (navigator.platform === 'Win32')
        $('body').addClass('windows');
    else if (navigator.platform == 'MacIntel')
        $('body').addClass('mac');
    else
        $('body').addClass('other');

    if (host.isElectron)
        $('body').addClass('electron');

    $(window).on('keydown', function(event) {
        if (event.key === 'F10' || event.keyCode === 121) {
            host.toggleDevTools();
        }
        else if (event.key === 'F9' || event.keyCode === 120) {
            instance.restartEngines();
        }
        else if (event.ctrlKey || event.metaKey) {
            if (event.key === 's')
                ActionHub.get('save').do();
        }
        else if (event.key === 'Escape') {
            optionspanel.hideOptions();
        }
    });

    if (host.isElectron && navigator.platform === 'Win32') {

        $('#close-button').on('click', event => host.closeWindow());
        $('#min-button').on('click', event => host.minimizeWindow());
        $('#max-button').on('click', event => host.maximizeWindow());
    }

    document.oncontextmenu = function() { return false; };

    // note: in linux, as of electron 1.7.9, the drop event is never fired,
    // so we handle the navigate event in the electron app
    document.ondragover = (event) => {
        event.dataTransfer.dropEffect = 'copy';
        event.preventDefault();
    };
    document.ondrop = (event) => {
        for (let file of event.dataTransfer.files)
            instance.open(file.path);
        event.preventDefault();
    };

    let ribbon = new Ribbon({ el : '.silky-ribbon', model : ribbonModel });
    let backstage = new Backstage({ el : '#backstage', model : backstageModel });

    ribbon.on('analysisSelected', function(analysis) {
        instance.createAnalysis(analysis.name, analysis.ns, analysis.title);
    });

    ribbon.on('tabSelected', function(tabName) {
        if (tabName === 'file')
            backstage.activate();
        else if (tabName === 'data')
            optionspanel.hideOptions();
        else if (tabName === 'analyses')
            dataSetModel.set('editingVar', null);
    });

    let halfWindowWidth = 585 + SplitPanelSection.sepWidth;
    let optionsFixedWidth = 585;
    let splitPanel  = new SplitPanel({el : '#main-view'});

    splitPanel.addPanel('main-table', { minWidth: 90, initialWidth: halfWindowWidth < (optionsFixedWidth + SplitPanelSection.sepWidth) ? (optionsFixedWidth + SplitPanelSection.sepWidth) : halfWindowWidth, level: 1});
    splitPanel.addPanel('main-options', { minWidth: optionsFixedWidth, maxWidth: optionsFixedWidth, preferredWidth: optionsFixedWidth, visible: false, strongEdge: 'right', stretchyEdge: 'left', level: 1 });
    splitPanel.addPanel('results', { minWidth: 150, initialWidth: halfWindowWidth, level: 0 });
    splitPanel.addPanel('help', { minWidth: 30, preferredWidth: 200, visible: false, strongEdge: 'right', level: 1 });

    instance.on('change:selectedAnalysis', function(event) {
        if ('selectedAnalysis' in event.changed) {
            let analysis = event.changed.selectedAnalysis;
            if (analysis !== null && typeof(analysis) !== 'string') {
                analysis.ready.then(function() {
                    splitPanel.setVisibility('main-options', true);
                    optionspanel.setAnalysis(analysis);
                    if (ribbonModel.get('selectedTab') === 'data')
                        ribbonModel.set('selectedTab', 'analyses');
                });
            }
            else {
                optionspanel.hideOptions();
            }
        }
    });

    instance.on('change:arbitraryCodePresent', (event) => {
        if ( ! instance.attributes.arbitraryCodePresent)
            return;
        let notif = ribbon.notify({
            text:  `One or more analyses in this data set have been disabled
                    because they allow the execution of arbitrary code. You
                    should only enable them if you trust this data set's
                    source.`,
            options: [
                { name: 'more-info', text: 'More info ...', dismiss: false },
                { name: 'dismiss',   text: "Don't enable" },
                { name: 'enable-code', text: 'Enable' } ]
        });
        // these splitPanel.resized(); should go somewhere else
        splitPanel.resized();
        notif.on('click', (event) => {
            if (event.name === 'enable-code')
                instance.trustArbitraryCode();
            else if (event.name === 'more-info')
                host.openUrl('https://www.jamovi.org/about-arbitrary-code.html');
        });
        notif.on('dismissed', (event) => {
            splitPanel.resized();
        });
    });

    instance.on('moduleInstalled', (event) => {
        optionspanel.reloadAnalyses(event.name);
    });

    let $fileName = $('.header-file-name');
    instance.on('change:title', function(event) {
        if ('title' in event.changed) {
            let title = event.changed.title;
            $fileName.text(title);
            document.title = title;
        }
    });

    let section = splitPanel.getSection('main-options');
    splitPanel.getSection('results').$panel.find('.hideOptions').click(function() {
        splitPanel.setVisibility('main-options', false);
    });

    let helpSection = splitPanel.getSection('help');
    splitPanel.getSection('results').$panel.find('.hideHelp').click(function() {
        splitPanel.setVisibility('help', helpSection.getVisibility() === false);
    });

    splitPanel.render();

    let mainTable   = new TableView({el : '#main-table', model : dataSetModel });

    backstageModel.on('change:activated', function(event) {
        if ('activated' in event.changed)
            mainTable.setActive( ! event.changed.activated);
    });

    let resultsView = new ResultsView({ el : '#results', iframeUrl : host.resultsViewUrl, model : instance });
    let optionspanel = new OptionsPanel({ el : '#main-options', iframeUrl : host.analysisUIUrl, model : instance });
    optionspanel.setDataSetModel(dataSetModel);
    optionspanel.$el.on('splitpanel-hide', () =>  window.focus() );

    let editor = new VariableEditor({ el : '#variable-editor', model : dataSetModel });
    editor.$el[0].addEventListener('transitionend', () => { splitPanel.resized(); }, false);
    editor.on('visibility-changing', value => {
        if (value === false) {
            let height = parseFloat(splitPanel.$el.css('height'));
            splitPanel.resized({ height: height + 200 });
        }
    });


    let notifications = new Notifications($('#notifications'));
    instance.on( 'notification', note => notifications.notify(note));
    mainTable.on('notification', note => notifications.notify(note));
    ribbon.on('notification', note => notifications.notify(note));
    editor.on('notification', note => notifications.notify(note));

    dataSetModel.on('change:edited', event => {
        host.setEdited(dataSetModel.attributes.edited);
    });

    host.on('close', event => {
        if (dataSetModel.attributes.edited) {
            let response = host.showMessageBox({
                type: 'question',
                buttons: [ 'Save', 'Cancel', "Don't Save" ],
                defaultId: 1,
                message: "Save changes to '" + instance.attributes.title + "'?",
            });
            if (response === 1) {  // Cancel
                event.preventDefault();
            }
            else if (response === 0) {  // Save
                event.preventDefault();
                backstageModel.externalRequestSave(true)
                    .then(() => host.closeWindow(true));
            }
        }
    });

    document.body.appendChild(infoBox);

    let toOpen = '';  // '' denotes blank data set

    try {

        await coms.ready;

        let instanceId;
        let match = /\/([a-z0-9-]+)\/$/.exec(window.location.pathname);
        if (match)
            instanceId = match[1];

        if (window.location.search.indexOf('?open=') !== -1) {
            toOpen = `${ window.location.search }${ window.location.hash }`.split('?open=')[1];
            if (toOpen.startsWith('http://') || toOpen.startsWith('https://'))
                ; // do nothing
            else
                toOpen = decodeURI(toOpen);
        }

        let status;

        if (host.isElectron) {
            // in electron we have fallbacks
            try {
                status = await instance.open(toOpen, { existing: !!instanceId });
            }
            catch (e) {
                // if opening fails, open a blank data set
                if (toOpen)
                    status = await instance.open('', { existing: !!instanceId });
                else
                    throw e;
            }
        }
        else {
            // we disable notification (on failure), because we present a big message
            status = await instance.open(toOpen, { existing: !!instanceId, notify: false });
        }

        if ('url' in status)
            history.replaceState({}, '', `${host.baseUrl}${status.url}`);

        if (status.message || status.title || status['message-src'])
            infoBox.setup(status);

        instanceId = /\/([a-z0-9-]+)\/$/.exec(window.location.pathname)[1];
        await instance.connect(instanceId);
    }
    catch (e) {

        if (e instanceof JError) {
            infoBox.setup({
                title: e.message,
                message: e.cause,
                status: e.status,
                'message-src': e.messageSrc,
            });
        }
        else {
            if (e.message)
                console.log(e.message);
            else
                console.log(e);

            infoBox.setup({
                title: 'Connection failed',
                message: 'Unable to connect to the server',
                status: 'disconnected',
            });
        }

        infoBox.style.display = null;
        await new Promise((resolve, reject) => { /* never */ });
    }

    if (instance.get('blank') && instance.analyses().count() === 0)
        resultsView.showWelcome();

});
