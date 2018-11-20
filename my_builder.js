'use strict';

//
//
// This file provides context for external YaaS modules.
//
//


function isDefinedNotNull(obj) {
    return obj !== null && obj !== undefined;
}


//
// This controls the angular js bootstrap mechanism.
// It disables auto-loading and allows us to bootstrap angular js when we need it.
//
window.name = 'NG_DEFER_BOOTSTRAP!yaas';


//
//
// Builder variable initialization
//

window.Builder = {};

window.CockpitNG = window.Builder;

Builder.initialized = false;
// Pragiti: Temporary hardcoded later will come from parent luigi backoffice
Builder.currentLanguage = "en-us";
var notificationConfigValue = {autoProcessing: true, autoNotifications: true};
Builder.notificationConfig = notificationConfigValue;
Builder.currentAccountId = null;

Builder.missingDependencies = [];

Builder.initialize = function(initFn) {
    window._init = initFn;
    if(Builder.initialized && window._init) {
        window._init();
    }
};

Builder.applyHelpMode = function(scope) {
    scope.helpMode = Builder.helpMode;
    Builder.onHelpModeChange = function(value) {
        scope.helpMode = value;
        scope.$apply();
    };
};

Builder.keepAlive = function() {
    Builder.postMsg("keepAlive", "keepAlive");
};


//
//
// Incoming message handler
//
//

window.addEventListener("message", function(e) {
    if($.isArray(e.data) && e.data.length > 1) {
        if(e.data[0] === "init") {

            var baasObject = JSON.parse(e.data[1]);

            for (var attribute in baasObject) {
                if (baasObject.hasOwnProperty(attribute)) {
                    Builder[attribute] = baasObject[attribute];
                }
            }

            Builder.initialized = true;

            if (window._init !== undefined) {
                window._init();
            }

            Builder.authManager()._setReAuthTimeout();

            $(document).ready(function () {
                if ((typeof angular !== "undefined") && (typeof angular.resumeBootstrap !== "undefined")) {
                    angular.resumeBootstrap();
                }
            });
        }
        else if (e.data[0] === "notificationConfirmed") {
            Builder.notificationManager.onOkCallback();
            Builder.notificationManager.onOkCallback = function(){};
            Builder.notificationManager.onCancelCallback = function(){};
        }
        else if (e.data[0] === "notificationCancelled") {
            Builder.notificationManager.onCancelCallback();
            Builder.notificationManager.onOkCallback = function(){};
            Builder.notificationManager.onCancelCallback = function(){};
        }
        else if (e.data[0] === "navigation") {
            var locData = JSON.parse(e.data[1]);

            if (locData.context) {
                for (var attr in locData.context) {
                    if (locData.context.hasOwnProperty(attr)) {
                        Builder[attr] = locData.context[attr];
                    }
                }
            }
            Builder.initialized = true;

            Builder.currentLocation = locData.path;
            window.location.replace(locData.url);
        }
        else if (e.data[0] === "goBackCallback") {
            var callback = Builder.goBackCallback;
            Builder.goBackCallback = undefined;
            if (callback) {
                callback(e.data[1] ? JSON.parse(e.data[1]).data : undefined);
            }
        }
        else if (e.data[0] === "helpModeChanged" && typeof(Builder.onHelpModeChange) === "function") {
            Builder.onHelpModeChange(e.data[1]);
        }
        else if (e.data[0] === "authData") {
            var authData = JSON.parse(e.data[1]);
            Builder.accessToken = authData.accessToken;
            Builder.accessTokenExpDate = authData.accessTokenExpDate;
            Builder.authManager()._setReAuthTimeout();
        }
        else if (e.data[0] === "wakeUp") {
            Builder.authManager()._setReAuthTimeout();
        }
        else if (e.data[0] === "fullScreenModeState") {
            Builder.moduleFullScreen._state = e.data[1];
        }
    }
});

Builder.postMsg = function(id, data) {
    var transferable = [id, JSON.stringify(data)];
    window.parent.postMessage(transferable, "*");
};

//
//
// Authorization Manager
//
//

Builder.postAuthMgr = function(id, data) {
    var payload = { "msg" : id };
    if(data !== undefined && data != null) {
        payload.data = data;
    }
    Builder.postMsg("authManager", payload);
}

Builder.authManager = function() {
    return {
        handleAuthError: function(navigationState, response) {
            Builder.postAuthMgr("authError",
                {
                    "response" : response,
                    "navigationState" : navigationState
                });
        },
        handleMissingToken: function(navigationState, response) {
            Builder.postAuthMgr("authError",
                {
                    "response" : response,
                    "navigationState" : navigationState
                });
        },
        getAccessToken: function() {
            return Builder.accessToken;
        },
        authorize: function () {
            return {then: function(success) { success({accessToken: Builder.accessToken, scope: Builder.scope, accessTokenExpirationDate: Builder.accessTokenExpDate}); }};
        },
        getScope: function() {
            return Builder.scope;
        },
        hasScope: function(scope) {
            var scopes = Builder.scope;
            if(scopes) {
                var scopeArray = decodeURI(scopes).split(" ");
                if(scopeArray.length > 0) {
                    return scopeArray.indexOf(scope) >= 0;
                }
            }
            return false;
        },
        accessTokenExpired : function() {
            return (Builder.accessToken!=="none" && Builder.accessTokenExpDate != undefined &&
                (Number(new Date())) >= Builder.accessTokenExpDate);
        },
        _setReAuthTimeout: function() {
            if(Builder.currentWidget.settings._client_id) {
                if(isDefinedNotNull(window.reAuthTimeout)) {
                    window.clearTimeout(window.reAuthTimeout);
                }
                var accessTokenExpDate = Builder.accessTokenExpDate;
                if(accessTokenExpDate != undefined) {
                    var reauthDate = accessTokenExpDate - ((Number(new Date())) + 45000);
                    if(reauthDate < 0) {
                        reauthDate = 0;
                    }
                    var that = this;
                    window.reAuthTimeout = window.setTimeout(function() {that._reAuth();}, reauthDate);
                }
            }
        },
        _reAuth: function() {
            Builder.postAuthMgr("authExp",
                {
                    "clientId" : Builder.currentWidget.settings._client_id,
                    "requiredScopes" : Builder.currentWidget.settings._required_scopes,
                    "region" : Builder._region
                });
        }
    };
};

//
//
// Notification Manager
//
//

Builder.postNotificationMgr = function(id, data) {
    var payload = { "msg" : id };
    if(data !== undefined && data != null) {
        payload.data = data;
    }
    Builder.postMsg("notificationManager", payload);
};

Builder.notificationManager = {
    pushProcessing : function () {
        Builder.postNotificationMgr("pushProcessing");
    },
    popProcessing : function () {
        Builder.postNotificationMgr("popProcessing");
    },
    clearProcessing : function () {
        Builder.postNotificationMgr("clearProcessing");
    },
    addNotification : function (notification) {
        Builder.postNotificationMgr("addNotification", notification);
    },
    addNotificationToCenter : function (notification) {
        Builder.postNotificationMgr("addNotificationToCenter", notification);
    },
    removeNotificationFromCenter : function (notification) {
        Builder.postNotificationMgr("removeNotificationFromCenter", notification);
    },
    addNotificationGroupToCenter : function (idPattern, notifications) {
        Builder.postNotificationMgr("addNotificationGroupToCenter", {idPattern: {source: idPattern.source, flags: idPattern.flags}, notifications: notifications});
    },
    showSuccess : function (msg, data) {
        Builder.postNotificationMgr("showSuccess", {message: msg, data: data});
    },
    showError : function(msg, data) {
        Builder.postNotificationMgr("showError", {message: msg, data: data});
    },
    showWarning : function(msg, data) {
        Builder.postNotificationMgr("showWarning", {message: msg, data: data});
    },
    showInfo : function(msg, data) {
        Builder.postNotificationMgr("showInfo", {message: msg, data: data});
    },
    showConfirmation : function (title, message, onConfirmCallback, onCancelCallback, data) {
        this.showModalDialog({
            message: message,
            title: title,
            onOk: onConfirmCallback,
            onCancel : onCancelCallback,
            fullBlocking : false,
            closeable: false,
            data: data
        });
    },
    showModalDialog : function (modalConfiguration) {
        this.onOkCallback = modalConfiguration.onOk;
        modalConfiguration.onOk = null;
        this.onCancelCallback = modalConfiguration.onCancel?modalConfiguration.onCancel:function(){};
        modalConfiguration.onCancel = null;

        Builder.postMsg("notificationManager", {
            msg: "showModalDialog",
            data: modalConfiguration
        });
    },
    getErrorMessage : function(errorResponse) {
        var msg = "";
        var error = errorResponse.data;
        if(error && Object.prototype.toString.call(error.details) === "[object Array]" && error.details.length > 0) {
            msg = "((msgdetails))";
            for(var i = 0; i< error.details.length; i++) {
                var detailedMsg = error.details[i].message;
                if(detailedMsg !== null && detailedMsg !== undefined && detailedMsg.length > 0) {
                    msg += (i!==0?"<br>":"") + detailedMsg;
                }
            }
        } else if(error && typeof error.message !== 'undefined' && error.message !== null ) {
            msg = error.message;
        } else {
            msg = " " + errorResponse.status + " " + errorResponse.statusText;
        }
        return msg;
    },
    markDirty : function(value) {
        Builder.postNotificationMgr("setPageDirty", value);
        Builder.notificationManager.dirty = value;
        if(this.dirtyCallback !== null && this.dirtyCallback !== undefined) {
            this.dirtyCallback(value);
        }
    },
    addDraftHandler: function (draftCfgList, restoreCallback, checkInterval) {
        var key = "external_drafts:" + Builder.linkManager().currentLocation().get();
        var interv = checkInterval ? checkInterval : 3000;

        this.dirtyCallback = function (dirty) {
            if (dirty === true) {
                var storeFn = function () {
                    if (Builder.notificationManager.dirty === true) {
                        var draft = {};
                        for (var j = 0; j < draftCfgList.length; j++) {
                            var cfg = draftCfgList[j];
                            var entry = {};
                            draft[cfg.id] = entry;
                            for (var i = 0; i < cfg.props.length; i++) {
                                entry[cfg.props[i]] = cfg.ref[cfg.props[i]];
                            }
                        }
                        localStorage.setItem(key, JSON.stringify(draft));
                    }
                };
                storeFn();
                clearInterval(window._dirtyIntervalId);
                window._dirtyIntervalId = setInterval(storeFn, interv);
            } else {
                localStorage.removeItem(key);
            }
        };

        if(Builder.hasOwnProperty("deleteDrafts")){
            if(Builder.deleteDrafts){
                Builder.notificationManager.dirty = false;
                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var keyToRemove = localStorage.key(i);
                    if (isDefinedNotNull(keyToRemove) && keyToRemove.indexOf("external_drafts") === 0) {
                        localStorage.removeItem(keyToRemove);
                    }
                }
            }
        }

        var draftStr = localStorage.getItem(key);
        if (draftStr !== null && draftStr !== undefined) {
            var draft = JSON.parse(draftStr);
            var restoreDraft = function(){
                restoreCallback(draft);
                localStorage.removeItem(key);
            };
            var cancelDraft = function(){
                localStorage.removeItem(key);
            };

            this.showModalDialog({
                "translate": true,
                "message": "NAVIGATION.RESTORE_DRAFT_MSG",
                "title": "NAVIGATION.RESTORE_DRAFT_TITLE",
                "onOk": restoreDraft,
                "onCancel" : cancelDraft,
                "fullBlocking" : false,
                "okLabel" : 'OK',
                "cancelLabel": 'Cancel',
                "closeable" : false
            });
        }
    }
};

Builder.setPageDirty = function(value) {
    Builder.notificationManager.markDirty(value);
};
Builder.addDraftHandler = function(draftCfgList, restoreCallback, checkInterval) {
    Builder.notificationManager.addDraftHandler(draftCfgList, restoreCallback, checkInterval);
};

//
//
// Link Manager
//
//

Builder.postLinkMgr = function(id, data) {
    var payload = { "msg" : id };
    if(data !== undefined && data != null) {
        payload.data = data;
    }
    Builder.postMsg("linkManager", payload);
}

Builder.linkManager = function() {
    return {
        _currentProject : null,
        _currentTeam : null,
        _currentLocation : null,
        _currentLink : null,
        _currentPath : null,
        _addReferrerFlag : false,

        path : function(link) {
            this._currentPath = link;
            return this;
        },
        _concat : function(link) {
            if (isDefinedNotNull(this._currentLink) && this._currentLink.length > 0) {
                this._currentLink = link + (this._currentLink.charAt(0) === '/' ? '' : '/') + this._currentLink;
            } else {
                this._currentLink = link;
            }
        },
        currentLocation : function() {
            this._currentLocation = Builder.currentLocation; return this;
        },
        currentProject : function() {
            this._currentProject = Builder.currentProjectPath; return this;
        },
        currentTeam : function() {
            return this.currentProject();
        },
        currentOrg : function() {
            this._currentOrganizationId = Builder.currentOrgPath; return this;
        },
        open : function(addToHistory, callback) {
            Builder.goBackCallback = callback;
            this._apply();
            Builder.postLinkMgr("open", { link : this._currentLink, addReferrer : this._addReferrerFlag, "addToHistory" : addToHistory });
            this._currentProject = null;
            this._currentTeam = null;
            this._currentLocation = null;
        },
        exists : function() {
            return Builder.allNodePaths.indexOf(this.get()) >= 0;
        },
        get : function() {
            return this._apply()._currentLink;
        },
        addReferrer : function(addReferrer) {
            this._addReferrerFlag = addReferrer?addReferrer:true; return this;
        },
        getReferrer : function() {
            return (Builder._referrer);
        },
        hasBack : function() {
            return Builder._hasBack ? true : false;
        },
        goBack : function(data) {
            Builder.postLinkMgr("goBack", { link : "none", data : data });
        },
        _apply : function() {
            if(isDefinedNotNull(this._currentPath)) {
                this._currentLink = this._currentPath.trim();
            }
            if(isDefinedNotNull(this._currentProject)) {
                this._concat(this._currentProject);
            }
            else if(isDefinedNotNull(this._currentTeam)) {
                this._concat(this._currentTeam);
            }
            else if(isDefinedNotNull(this._currentOrganizationId)) {
                this._concat(this._currentOrganizationId);
            }
            else if(isDefinedNotNull(this._currentLocation)) {
                this._concat(this._currentLocation);
            }
            return this;
        },
        encodeValue : function(pathString){
            var encodedValue = encodeURIComponent(pathString)
            return encodedValue.replace(/~/g, '%7E').
            replace(/!/g,'%21').
            replace(/'/g,'%27').
            replace(/\(/g,'%28').
            replace(/\)/g,'%29');
        },
        decodeValue : function(pathString){
            return decodeURIComponent(pathString);
        }
    };
};

Builder.moduleFullScreen = {
    turnOn: function() {
        Builder.postMsg('builderModuleFullScreen', {msg: 'on'});
    },
    turnOff: function() {
        Builder.postMsg('builderModuleFullScreen', {msg: 'off'});
    },
    isOn: function() {
        return this._state === 'on';
    },
    _state: 'off'
};

/**
 * Angular JS module containing restangular wrapper which automatically
 * handles authentication token.
 * @type {*|module}
 *
 */
if (typeof angular !== "undefined") {
    (function () {
        var restangularPresent = true;
        try {
            angular.module('restangular');
        } catch (err) {
            Builder.missingDependencies.push("restangular");
            restangularPresent = false;
        }
        var translatePresent = true;
        try {
            angular.module('builder.translations');
        } catch (err) {
            translatePresent = false;
        }
        var deps = [];
        if(restangularPresent) {
            deps.push('restangular');
        }
        if(translatePresent) {
            deps.push('builder.translations');
        }
        var module = angular.module('builder', deps);
        module.factory("currentWidget", function currentWidgetFactory() {
            return Builder.currentWidget;
        });
        module.factory("currentAccountId", function currentAccountIdFactory() {
            return Builder.currentAccountId;
        });
        module.factory("currentOrganizationId", function currentOrganizationIdFactory() {
            return Builder.currentOrganizationId;
        });
        module.factory("currentTeamId", function currentTeamIdFactory() {
            return Builder.currentProjectId;
        });
        module.factory("currentProjectId", function currentProjectIdFactory() {
            return Builder.currentProjectId;
        });
        module.factory("currentProjectLocales", function currentProjectLocalesFactory() {
            return Builder.currentProjectLocales;
        });
        module.factory("linkManager", function linkManagerFactory() {
            return Builder.linkManager;
        });
        module.factory("authManager", function authManagerFactory() {
            return Builder.authManager;
        });
        module.factory("notificationConfig", function notificationConfigFactory() {
            return Builder.notificationConfig;
        });
        module.factory("notificationManager", function notificationManagerFactory() {
            return Builder.notificationManager;
        });

        if (!restangularPresent) {
            return;
        }

        module.run(['Restangular', 'authManager', 'linkManager', 'currentAccountId', '$timeout',
            function (Restangular, authManager, linkManager, currentAccountId, $timeout) {

                var whiteList = [
                    {httpMethod: "remove", status: "200", level: "alert-success", message: "Data deleted successfully"},
                    {httpMethod: "post", status: "200", level: "alert-success", message: "Data created successfully"},
                    {httpMethod: "put", status: "200", level: "alert-success", message: "Data updated successfully"}
                ];

                var autoProcessing = function(operation) {
                    return (operation.toUpperCase() != "GET" && operation.toUpperCase() != "GETLIST");
                };
                var isAutoErrorNotificationsEnabled = function() {
                    if (Builder.notificationConfig.autoErrorNotifications !== undefined)
                        return Builder.notificationConfig.autoErrorNotifications;
                    else
                        return Builder.notificationConfig.autoNotifications;
                };
                var isAutoSuccessNotificationsEnabled = function() {
                    if (Builder.notificationConfig.autoSuccessNotifications !== undefined)
                        return Builder.notificationConfig.autoSuccessNotifications;
                    else
                        return Builder.notificationConfig.autoNotifications;
                };

                Restangular.setDefaultHttpFields({
                    timeout: 60000
                });

                Restangular.addFullRequestInterceptor(
                    function (element, operation, what, url, headers, queryparams) {
                        headers['Authorization'] = 'Bearer ' + Builder.authManager().getAccessToken();
                        if(!headers['Content-Type']){
                            headers['Content-Type'] = 'application/json';
                        }
                        if (Builder.notificationConfig.autoProcessing && autoProcessing(operation)) {
                            Builder.notificationManager.pushProcessing();
                        }
                        return {
                            headers: headers
                        };
                    }
                );
                Restangular.setErrorInterceptor(
                    function (response, deferred, responseHandler) {
                        if (Builder.notificationConfig.autoProcessing && autoProcessing(response.config.method)) {
                            Builder.notificationManager.popProcessing();
                        }

                        //when response data is "" it is not an error actually, but a request cancelled by a browser
                        if (response.status == 0 && response.data === "") {
                            return false;
                        }

                        if (response.status == 0)
                        {
                            Builder.notificationManager.showError("Service not reachable : " + response.config.url);
                            Builder.notificationManager.clearProcessing();
                        }

                        if (response.status == 401 && Builder.authManager().accessTokenExpired()) {
                            var navigationState = Builder.linkManager().currentLocation().get();
                            Builder.authManager().handleAuthError(navigationState, response);
                            return false;
                        }
                        else if (isAutoErrorNotificationsEnabled()) {
                            if (response.status == 0 || response.status - 400 >= 0) {
                                var errorMsg = Builder.notificationManager.getErrorMessage(response);
                                Builder.notificationManager.addNotification({
                                    level: "alert-danger",
                                    message: "An error has occurred while accessing " + response.config.url + ": " + errorMsg,
                                    status: response.status
                                });
                            }
                        }
                    }
                );
                Restangular.addResponseInterceptor(
                    function (data, operation, what, url, response, deferred) {
                        if (Builder.notificationConfig.autoProcessing && autoProcessing(operation)) {
                            Builder.notificationManager.popProcessing();
                        }

                        if (isAutoSuccessNotificationsEnabled()) {
                            for (var index = 0; index < whiteList.length; index++) {
                                var notificationEntry = whiteList[index];
                                if (whiteList[index].httpMethod == operation && response.status == notificationEntry.status) {
                                    Builder.notificationManager.addNotification({
                                        level: notificationEntry.level,
                                        message: notificationEntry.message,
                                        status: notificationEntry.status,
                                        httpMethod: notificationEntry.httpMethod
                                    });
                                }
                            }
                        }

                        return data;
                    });
            }]
        );

    })();

    var ngTranslatePresent = true;
    try {
        angular.module('pascalprecht.translate');
    } catch (err) {
        ngTranslatePresent = false;
    }
    if(ngTranslatePresent) {
        var defaultTranslationsModule = angular.module('builder.translateStatic', ['pascalprecht.translate']);
        defaultTranslationsModule.constant('fallbackLanguage',
            'en'
        );
        defaultTranslationsModule.constant('languageMappings',
            {
                'en-*': 'en',
                'en_*': 'en',
                'de-*': 'de',
                'de_*': 'de',
                'zh-*': 'zh',
                'zh_*': 'zh',
                '*': 'en'
            }
        );
        defaultTranslationsModule.config(['$translateProvider', 'fallbackLanguage', 'languageMappings',
            function ($translateProvider, fallbackLanguage, languageMappings) {
                $translateProvider.useStaticFilesLoader({
                    prefix: Builder.globalSettings.redirect_uri + '/locales/locale_',
                    suffix: '.json?v=' + Builder.globalSettings.version
                })
                    .registerAvailableLanguageKeys(Builder.globalSettings.availableLanguages, languageMappings)
                    .fallbackLanguage(fallbackLanguage);
                var curr = Builder.currentLanguage ? Builder.currentLanguage : "en";
                $translateProvider.preferredLanguage(curr);
                $translateProvider.use(curr);
                $translateProvider.useSanitizeValueStrategy(null);
            }]);

        var translationsModule = angular.module('builder.translate', ['pascalprecht.translate']);
        translationsModule.constant('fallbackLanguage',
            'en'
        );
        translationsModule.constant('languageMappings',
            {
                'en-*': 'en',
                'en_*': 'en',
                'de-*': 'de',
                'de_*': 'de',
                'zh-*': 'zh',
                'zh_*': 'zh',
                '*': 'en'
            }
        );
        translationsModule.config(['$translateProvider', 'fallbackLanguage', 'languageMappings',
            function ($translateProvider, fallbackLanguage, languageMappings) {
                $translateProvider.useStaticFilesLoader({
                    files: [{
                        prefix: Builder.globalSettings.redirect_uri + '/locales/locale_',
                        suffix: '.json?v=' + Builder.globalSettings.version
                    },{
                        prefix: '/locales/locale_',
                        suffix: '.json?v=' + (window.cache_breaker ? window.cache_breaker : 0)
                    }]
                })
                    .registerAvailableLanguageKeys(Builder.globalSettings.availableLanguages, languageMappings)
                    .fallbackLanguage(fallbackLanguage);
                var curr = Builder.currentLanguage ? Builder.currentLanguage : "en";
                $translateProvider.preferredLanguage(curr);
                $translateProvider.use(curr);
                $translateProvider.useSanitizeValueStrategy(null);
            }]);
    }
} else {
    Builder.missingDependencies.push("angular");
}

$(document).ready(function () {
    if (Builder.missingDependencies.length > 0) {
        var errMsg = "'{v1}' has been defined after Builder. Make sure you have included builder.js as the last script" +
            " before the angular controller in your html.";
        if (Builder.missingDependencies.indexOf("angular") >= 0
            && typeof angular !== "undefined") {
            console.error(errMsg.replace(/{v1}/g, "angular"));
        }
        if (Builder.missingDependencies.indexOf("restangular") >= 0) {
            try {
                angular.module('restangular');
                console.error(errMsg.replace(/{v1}/g, "restangular"));
            } catch (err) {
                // restangular still missing, which is fine.
            }
        }
    }
});
$(document).ready(function () {
    if ((typeof angular !== "undefined") && (typeof angular.resumeBootstrap !== "undefined")) {
        angular.resumeBootstrap();
    }
});