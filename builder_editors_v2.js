(function () {
    'use strict';

    console.error('This version of Builder Editors (V2) component is deprecated, and soon will be deleted. Please upgrade it to the latest version. Visit https://devportal.yaas.io/tools/buildersdk/index.html#ImplementationGuidefortheBuilderEditorModuleversion3 for more information.')

    var module = angular.module('builder_editors', []);

    module.directive("baasValidate", function () {
        return{
            restrict: 'A',
            priority: 5,
            link: function (scope, element, attrs, formCtrl) {
                var revalidate = function (event, args) {
                    if (!scope.isFormValid()) {
                        element.removeClass(scope.cssWarningClass);
                        element.addClass(scope.cssErrorClass);
                    }
                };
                scope.$watch(function (oldVal, newVal) {
                    return scope.isFormValid();
                }, function () {
                    if (scope.isFormValid()) {
                        element.removeClass(scope.cssWarningClass);
                        element.removeClass(scope.cssErrorClass);
                    } else {
                        element.addClass(scope.cssWarningClass);
                    }
                });
                scope.$watch('formName', function (oldVal, newVal) {
                    if (scope.formName) {
                        var eventName = scope.formName + '-validate-on-save';
                        scope.$on(eventName, revalidate);
                    }
                });

            }
        }
    });
    module.directive("baasFieldValidate", function () {
        return{
            restrict: 'A',
            require: 'ngModel',
            priority: 4,
            link: function (scope, element, attrs, formCtrl) {
                var revalidateField = function (event, args) {
                    if (!scope.$parent.isFieldValid(scope.iso)) {
                        element.removeClass(scope.$parent.cssWarningClass);
                        element.addClass(scope.$parent.cssErrorClass);
                    }
                };
                scope.$watch(function (oldVal, newVal) {
                    return scope.$parent.isFieldValid(scope.iso);
                }, function () {
                    if (scope.$parent.isFieldValid(scope.iso)) {
                        element.removeClass(scope.$parent.cssWarningClass);
                        element.removeClass(scope.$parent.cssErrorClass);
                    } else {
                        element.addClass(scope.$parent.cssWarningClass);
                    }
                });
                scope.$watch('$parent.formName', function (oldVal, newVal) {
                    if (scope.$parent.formName) {
                        var eventName = scope.$parent.formName + '-validate-on-save';
                        scope.$on(eventName, revalidateField);
                    }
                });
            }
        }
    });
    module.directive('baasFormName', function () {
        return {
            restrict: 'A',
            priority: 1,
            require: 'form',
            compile: function () {
                return {
                    pre: function (scope, element, attrs, ctrl) {
                        var parentForm = $(element).parent().controller('form');
                        if (parentForm) {
                            var formCtrl = ctrl;
                            delete parentForm[formCtrl.$name];
                            formCtrl.$name = scope.iso;
                            parentForm[formCtrl.$name] = formCtrl;
                        }
                    }
                }
            }
        };
    });
    module.directive("baasRequired", function () {
        return{
            restrict: 'A',
            require: 'ngModel',
            priority: 3,
            link: function (scope, element, attrs, ctrl) {
                    var applyValidity = function () {
                        scope.$parent.setValidity(scope.iso);
                        var valid = scope.$parent.isFieldValid(scope.iso);
                        ctrl.$setValidity('baas-required', valid);
                    };
                    scope.$watch('$parent.data[iso]', function (newVal, oldVal) {
                        applyValidity();
                    });
            }
        }
    });
    module.directive("baasNumber", function () {
        return {
            restrict: 'A',
            require: '?ngModel',
            scope: {
                allowNegative: '@',
                minNum: '@',
                maxNum: '@'
            },

            link: function (scope, element, attrs, ctrl) {
                if (!ctrl) return;
                ctrl.$parsers.unshift(function (inputValue) {
                    var caretPosition = angular.element(element)[0].selectionStart;
                    var decimalFound = false;
                    var digits = inputValue.split('').filter(function (s, i) {
                        var b = (!isNaN(s) && s != ' ');
                        if (decimalFound) {
                            if ((inputValue.indexOf('.') == (i - 1) || inputValue.indexOf('.') == (i - 2)) && b) {
                                b = true;
                            } else {
                                b = false;
                            }
                        }
                        if (s == "." && decimalFound == false && i != 0) {
                            decimalFound = true;
                            b = true;
                        }
                        if (!b && attrs.allowNegative && attrs.allowNegative == "true") {
                            b = (s == '-' && i == 0);
                        }

                        return b;
                    }).join('');
                    ctrl.$viewValue = digits;
                    ctrl.$render();

                    angular.element(element)[0].selectionStart = angular.element(element)[0].selectionEnd = caretPosition;

                    return digits;
                });
            }
        };
    });
    module.directive("localizedTextEditor", function ($compile) {
        return {
            restrict: 'E',
            require: 'form',
            priority: 0,
            scope: {
                data: "=",
                label: "=",
                builderEditorType: "@",
                builderEditorRows: "=",
                builderValidateRequiredLanguages: "=",
                builderLocaleType: "@",
                builderLocales: "=",
                select: "&onSelect"
            },
            link: function (scope, element, attrs, ctrl) {
                var expanded;
                scope.errors = false;
                scope.currentLocales = undefined;
                scope.keys = [];
                scope.templateType = undefined;

                var hasErrors = function () {
                    if (!attrs.builderLocaleType){
                        console.error('Attribute builder-locale-type is required.');
                        scope.errors = true;
                    }
                    if (attrs.builderLocaleType != "currencies" && attrs.builderLocaleType != "languages") {
                        console.error('"currencies" or "languages" are acceptable values for builder-locale-type attribute.');
                        scope.errors = true;
                    }
                    if (attrs.builderLocaleType == "currencies" && attrs.builderEditorType == "tab") {
                        console.error('Multiline currency editor is invalid.');
                        scope.errors = true;
                    }
                    if (!Builder.currentProjectLocales[attrs.builderLocaleType] && !scope.builderLocales){
                        console.error('Locale configuration is missing.');
                        scope.errors = true;
                    }
                    if (scope.builderLocales){
                        if (!validateLocales()) {
                            console.error('Wrong object passed via builder-locales attribute. Please refer to documentation.');
                            scope.errors = true;
                        }
                    }
                };

                var validateLocales = function () {
                    var valid = true;
                    _.forEach(scope.builderLocales, function (iso) {
                        var properties = _.keys(iso);
                        if (properties.indexOf('default') == -1 || properties.indexOf('required') == -1)
                            valid = false;
                    });
                    return valid;
                };

                var setTemplateType = function () {
                    if (scope.errors) {
                        scope.templateType = "error";
                    } else if (attrs.builderLocaleType == "currencies" & attrs.builderEditorType !== "tab") {
                        scope.templateType = "currencies";
                    } else if (attrs.builderLocaleType == "languages" & attrs.builderEditorType !== "tab") {
                        scope.templateType = "simple";
                    } else {
                        scope.templateType = "multi";
                    }
                };

                var prepareConfiguration = function () {
                    scope.validate = "true" === attrs.builderValidateRequiredLanguages ? true : false;
                    scope.cssWarningClass = 'has-warning';
                    scope.cssErrorClass = 'has-error';
                    scope.globeVisible = scope.keys.length > 1;
                    scope.formName = ctrl.$name;
                };

                scope.isFieldValid = function (isoCode) {
                    return scope.currentLocales[isoCode].valid;
                };

                scope.setValidity = function (isoCode) {
                    var valid = true;
                    if (scope.validate) {
                        if (scope.currentLocales[isoCode].required
                            && (scope.data[isoCode] === undefined || scope.data[isoCode] == '')) {
                            valid = false;
                        }
                    }
                    angular.extend(scope.currentLocales[isoCode], {valid: valid});
                };

                scope.isFormValid = function () {
                    var invalidItem = _.find(_.keys(scope.currentLocales), function (iso) {
                        return scope.isFieldValid(iso) == false;
                    });
                    return invalidItem == undefined;
                };

                var prepareLocales = function () {
                    if (!scope.builderLocales) {
                        scope.currentLocales = {};
                        for (var index = 0; index < Builder.currentProjectLocales[attrs.builderLocaleType].length; ++index) {
                            var isoCode = Builder.currentProjectLocales[attrs.builderLocaleType][index].id;
                            scope.currentLocales[isoCode] = {
                                default: Builder.currentProjectLocales[attrs.builderLocaleType][index].default,
                                required: Builder.currentProjectLocales[attrs.builderLocaleType][index].required
                            };
                        }
                    }
                    else {
                        scope.currentLocales = angular.copy(scope.builderLocales);
                    }
                    scope.keys = _.keys(scope.currentLocales);
                };

                var prepareData = function () {
                    if (scope.keys.length > _.keys(scope.data).length) {
                        var originalData = scope.data;
                        scope.data = {};
                        _.forEach(scope.keys, function (isoCode) {
                            scope.setValidity(isoCode);
                            scope.currentLocales[isoCode].visible = false;
                            if (originalData && originalData[isoCode]) {
                                scope.data[isoCode] = originalData[isoCode];
                            }
                        });
                    }
                };
                var setVisible = function (visible) {
                    _.forEach(scope.currentLocales, function (lang) {
                        lang.visible = visible;
                    });
                };

                scope.setTab = function (index, event) {
                    var element = event.target;
                    var navs = $(element).closest("div.scrollable-tabs").find(".nav-tabs").children();
                    var tabPanes = $(element).closest("div.scrollable-tabs-container").next().find(".tab-pane");
                    navs.removeClass("active");
                    tabPanes.removeClass("active in");
                    $(navs.get(index)).addClass("active");
                    $(tabPanes.get(index)).addClass("active in");
                    scope.select({"iso":scope.keys[index]});
                };
                scope.toggle = function () {
                    expanded = !expanded;
                    setVisible(expanded);
                };
                scope.isVisible = function (isoCode) {
                    return scope.currentLocales[isoCode].default || scope.currentLocales[isoCode].visible;
                };
                scope.isExpanded = function () {
                    return expanded;
                };
                scope.getTemplate = function () {
                    if (scope.templateType == "simple") {
                        return '<style> .validation-status {  font-size: 16px;  padding: 6px 0;  line-height: 1.42857143;  display: inline-block;  color: #c9c9c9;  vertical-align: middle;} .locals-header {min-height: 41px;}</style><div class=\"form-group locals-editor\">\r\n    <div class=\"locals-header clearfix\">\r\n        <div class=\"pull-right\" ng-show=\"globeVisible\">\r\n            <div class=\"validation-status\" baas-validate>\r\n                <span class=\"glyphicon glyphicon-globe\"><\/span>\r\n            <\/div>\r\n            <a href=\"\" class=\"btn-link btn\" ng-click=\"toggle()\">\r\n                    <span class=\"glyphicon \"\r\n                          ng-class=\"{\'glyphicon-chevron-down\' : isExpanded(), \'glyphicon-chevron-right\': !isExpanded()}\">\r\n                <\/span><\/a>\r\n        <\/div>\r\n        <label class=\"control-label\">{{label}}<\/label>\r\n    <\/div>\r\n\r\n    <div class=\"form-group\" ng-repeat=\"iso in keys\">\r\n        <div class=\"input-group property\"\r\n             baas-form-name\r\n             ng-form=\"innerForm\"\r\n             ng-show=\"isVisible(iso)\"\r\n             baas-required\r\n             baas-field-validate\r\n             ng-model=\"iso\">\r\n            <input name=\"name\" type=\"text\" class=\"form-control input-lg\" ng-model=\"data[iso]\">\r\n            <span class=\"input-group-addon\">{{iso}}<\/span>\r\n        <\/div>\r\n    <\/div>\r\n<\/div>'
                    } else if (scope.templateType == "multi") {
                        return '<style> .validation-status {  font-size: 16px;  padding: 6px 0;  line-height: 1.42857143;  display: inline-block;  color: #c9c9c9;  vertical-align: middle;} .locals-header {min-height: 41px;}</style><div class=\"form-group\" ng-class=\"{\'baas-editor-expanded\' : isExpanded()}\">\r\n    <div class=\"locals-header clearfix\" style=\"display:none\">\r\n        <div class=\"pull-right\" ng-show=\"globeVisible\">\r\n            <div class=\"validation-status\" baas-validate>\r\n                <span class=\"glyphicon glyphicon-globe\"><\/span>\r\n            <\/div>\r\n            <a href=\"\" class=\"btn-link btn\" ng-click=\"toggle()\">\r\n                    <span class=\"glyphicon \"\r\n                          ng-class=\"{\'glyphicon-chevron-down\' : isExpanded(), \'glyphicon-chevron-right\': !isExpanded()}\"\r\n                            >\r\n                    <\/span>\r\n            <\/a>\r\n        <\/div>\r\n        <label class=\"control-label\">{{label}}<\/label>\r\n    <\/div>\r\n\r\n    <div class=\"scrollable-tabs-container\">\r\n        <a class=\"scroller scroller-left\"><i class=\"glyphicon glyphicon-chevron-left\"><\/i><\/a>\r\n        <a class=\"scroller scroller-right\"><i class=\"glyphicon glyphicon-chevron-right\"><\/i><\/a>\r\n\r\n        <div class=\"scrollable-tabs\">\r\n            <ul class=\"nav nav-tabs\" role=\"tablist\">\r\n                <li class=\"property\"\r\n                    ng-class=\"{active: $index == 0}\"\r\n                   ng-repeat=\"iso in keys\"                   baas-field-validate\r\n                    ng-model=\"iso\">\r\n                    <a role=\"tab\" data-toggle=\"tab\" ng-click=\"setTab($index, $event)\">{{iso}}<\/a>\r\n                <\/li>\r\n            <\/ul>\r\n        <\/div>\r\n    <\/div>\r\n    <div class=\"tab-content\">\r\n        <div class=\"tab-pane fade\"\r\n             ng-class=\"{active: $index == 0, in: $index == 0}\"\r\n             ng-repeat=\"iso in keys\"             baas-required\r\n             baas-field-validate\r\n             ng-model=\"iso\"\r\n             ng-form=\"innerForm\"\r\n             baas-form-name>\r\n            <div class=\"y-locale-label clearfix\">\r\n                <div class=\"nav-pill\" style=\"display:none\">{{iso}}<\/div>\r\n            <\/div>\r\n            <textarea type=\"text\" class=\"form-control input-lg\" ng-model=\"data[iso]\"\r\n                      rows=\"{{builderEditorRows}}\"><\/textarea>\r\n        <\/div>\r\n    <\/div>\r\n<\/div>'
                    } else if (scope.templateType == "currencies") {
                        return '<style> .validation-status {  font-size: 16px;  padding: 6px 0;  line-height: 1.42857143;  display: inline-block;  color: #c9c9c9;  vertical-align: middle;} .locals-header {min-height: 41px;}</style><div class=\"form-group locals-editor\">\r\n    <div class=\"locals-header clearfix\">\r\n        <div class=\"pull-right\" ng-show=\"globeVisible\">\r\n            <div class=\"validation-status\" baas-validate>\r\n                <span class=\"glyphicon glyphicon-globe\"><\/span>\r\n            <\/div>\r\n            <a href=\"\" class=\"btn-link btn\" ng-click=\"toggle()\">\r\n                    <span class=\"glyphicon \"\r\n                          ng-class=\"{\'glyphicon-chevron-down\' : isExpanded(), \'glyphicon-chevron-right\': !isExpanded()}\">\r\n                <\/span><\/a>\r\n        <\/div>\r\n        <label class=\"control-label\">{{label}}<\/label>\r\n    <\/div>\r\n\r\n    <div class=\"form-group\" ng-repeat=\"iso in keys\">\r\n        <div class=\"input-group property\"\r\n             baas-form-name\r\n             ng-form=\"innerForm\"\r\n             ng-show=\"isVisible(iso)\"\r\n             baas-required\r\n             baas-field-validate\r\n             ng-model=\"iso\">\r\n            <input  baas-number allow-decimal="true" placeholder="0.00" name=\"name\" type=\"text\" class=\"form-control input-lg\" ng-model=\"data[iso]\">\r\n            <span class=\"input-group-addon\">{{iso}}<\/span>\r\n        <\/div>\r\n    <\/div>\r\n<\/div>'
                    } else {
                        return '<div><span style="color:red">Error - Wrong configuration of Localized Editor - get in touch with Project Administrator</span></div>'
                    }
                }

                var initialization = function () {
                    hasErrors();
                    if (!scope.errors) {
                        prepareLocales();
                        prepareData();
                        prepareConfiguration();
                    }
                    setTemplateType();
                    element.html(scope.getTemplate()).show();
                    $compile(element.contents())(scope);
                };
                initialization();
            }
        };
    });

})();
