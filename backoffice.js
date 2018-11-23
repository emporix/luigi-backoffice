// Listening to Luigi init
LuigiClient.addInitListener(init => { 
    var initData = init;
    var baasObject = initData;
    var transferObject = new Object();
    for (var attribute in baasObject) {
        if (baasObject.hasOwnProperty(attribute)) {
            transferObject[attribute] = baasObject[attribute];
        }
    }
    window.postMessage(["init", JSON.stringify(transferObject)], "*")
});