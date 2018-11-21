window.Builder = {};
// Listening to Luigi init
LuigiClient.addInitListener(init => { 
    var initData = init;
    var baasObject = initData;
    for (var attribute in baasObject) {
        if (baasObject.hasOwnProperty(attribute)) {
            window.Builder[attribute] = baasObject[attribute];
        }
    }
    // resumeBootstrap for interface
    $(document).ready(function () {
        if ((typeof angular !== "undefined") && (typeof angular.resumeBootstrap !== "undefined")) {
            angular.resumeBootstrap();
        }
    });
});