var HEADER_KEY = 'RS_HEADER_KEY';
var HEADER_REPO = {};
// region classes
var HttpService = (function () {
    function HttpService() {
    }
    HttpService.prototype.sendRequest = function (options) {
        console.debug('sendRequest options:', options);
        var promise = axios.request(options);
        return promise;
    };
    return HttpService;
}());
var MessageHandler = (function () {
    function MessageHandler() {
    }
    MessageHandler.prototype.onMessageReceived = function (message, port) {
        console.info('onMessageReceived', message);
        switch (message.type) {
            case MessageType.PING:
                this.handlePing(port, message.id);
                break;
            case MessageType.HTTP_REQUEST:
                this.handleHttpRequest(message.id, message.payload, port);
                break;
        }
    };
    MessageHandler.prototype.handleHttpRequest = function (id, payload, port) {
        var _this = this;
        var http = new HttpService();
        var response = new ExtensionResponse(MessageType.HTTP_REQUEST, id);
        var start = Date.now();
        // hold headers because chrome truncate a few headers like 'User-Agent'
        var options = payload.options;
        options.headers = { 'User-Agent': 'Rest.Studio' };
        if (!_.isEmpty(options.headers)) {
            HEADER_REPO[id] = options.headers;
            options.headers = { RS_HEADER_KEY: id };
        }
        http.sendRequest(payload.options)
            .then(function (axiosResponse) {
            console.debug('axiosResponse', axiosResponse);
            response.payload = {
                response: axiosResponse,
                timeSpan: {
                    start: start,
                    end: Date.now()
                }
            };
            _this.sendResponse(options.url, response, port);
        })
            .catch(function (axiosError) {
            response.payload = {
                error: axiosError,
                timeSpan: {
                    start: start,
                    end: Date.now()
                }
            };
            _this.sendResponse(options.url, response, port);
        });
    };
    MessageHandler.prototype.sendResponse = function (url, response, port) {
        this.getCookies(url)
            .then(function (cookies) {
            response.payload.cookies = cookies;
            port.postMessage(response);
        })
            .catch(function (err) {
            port.postMessage(response);
        });
    };
    MessageHandler.prototype.handlePing = function (port, id) {
        port.postMessage(new ExtensionResponse(MessageType.PING, id));
    };
    MessageHandler.prototype.getCookies = function (url) {
        return new Promise(function (resolve) {
            chrome.cookies.getAll({ url: url }, function (cookies) {
                resolve(cookies);
            });
        });
    };
    return MessageHandler;
}());
var RequestHandler = (function () {
    function RequestHandler() {
    }
    return RequestHandler;
}());
// endregion
// region chrome handler
{
    chrome.runtime.onConnectExternal.addListener(function (port) {
        console.debug('adding onConnect listener', port);
        console.debug('port is connected');
        var messageHandler = new MessageHandler();
        port.onMessage.addListener(function (message) {
            console.debug('port.onMessage', message);
            messageHandler.onMessageReceived(message, port);
        });
    });
    chrome.runtime.onInstalled.addListener(function (details) {
        console.log('previousVersion', details.previousVersion);
    });
    chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        // console.debug('details:', details);
        var requestHeaders = details.requestHeaders;
        if (!_.isEmpty(requestHeaders)) {
            var rsHeader = _.find(requestHeaders, function (header) { return header.name === HEADER_KEY; });
            if (rsHeader) {
                console.debug('before headers', requestHeaders);
                _.pull(requestHeaders, rsHeader);
                var headers_1 = HEADER_REPO[rsHeader.value];
                if (!_.isEmpty(headers_1)) {
                    _.keys(headers_1, function (name) {
                        requestHeaders.push({ name: name, value: headers_1[name] });
                    });
                }
                console.debug('actual headers', requestHeaders);
            }
        }
        return { requestHeaders: requestHeaders };
    }, { urls: ['<all_urls>'] }, ['blocking', 'requestHeaders']);
    console.log('Chrome Listeners are set up ......');
}
// endregion
// region type definition
var MessageType;
(function (MessageType) {
    MessageType[MessageType["PING"] = 'PING'] = "PING";
    MessageType[MessageType["HTTP_REQUEST"] = 'HTTP_REQUEST'] = "HTTP_REQUEST";
})(MessageType || (MessageType = {}));
var ExtensionMessage = (function () {
    function ExtensionMessage() {
    }
    return ExtensionMessage;
}());
var HttpRequest = (function () {
    function HttpRequest() {
    }
    return HttpRequest;
}());
var ExtensionResponse = (function () {
    function ExtensionResponse(type, id, payload) {
        this.type = type;
        this.id = id;
        this.payload = payload;
    }
    return ExtensionResponse;
}());
// endregion 
