declare const chrome: any,
    axios: any, _: any;

const HEADER_KEY = 'RS_HEADER_KEY';
const HEADER_REPO = {};

// region classes
class HttpService {
    sendRequest(options: any) {
        console.debug('sendRequest options:', options);
        let promise = axios.request(options);
        return promise;
    }
}

class MessageHandler {
    public onMessageReceived(message: ExtensionMessage, port: any) {
        console.info('onMessageReceived', message);
        switch (message.type) {
            case MessageType.PING:
                this.handlePing(port, message.id);
                break;
            case MessageType.HTTP_REQUEST:
                this.handleHttpRequest(message.id, message.payload, port);
                break;
        }
    }

    private handleHttpRequest(id: string, payload: HttpRequestPayload, port: any) {
        let http = new HttpService();
        let response = new ExtensionResponse(MessageType.HTTP_REQUEST, id);
        let start = Date.now();

        // hold headers because chrome truncate a few headers like 'User-Agent'
        let options = payload.options;
        options.headers = {'User-Agent': 'Rest.Studio'};
        if (!_.isEmpty(options.headers)) {
            HEADER_REPO[id] = options.headers;
            options.headers = { RS_HEADER_KEY: id };
        }

        http.sendRequest(payload.options)
            .then(axiosResponse => {
                console.debug('axiosResponse', axiosResponse);
                response.payload = {
                    response: axiosResponse,
                    timeSpan: {
                        start,
                        end: Date.now()
                    }
                } as HttpResponsePayload;
                this.sendResponse(options.url, response, port);
            })
            .catch(axiosError => {
                response.payload = {
                    error: axiosError,
                    timeSpan: {
                        start,
                        end: Date.now()
                    }
                } as HttpResponsePayload;
                this.sendResponse(options.url, response, port);
            });
    }

    private sendResponse(url: string, response: ExtensionResponse, port: any) {
        this.getCookies(url)
            .then(cookies => {
                response.payload.cookies = cookies;
                port.postMessage(response);
            })
            .catch(err => {
                port.postMessage(response);
            });
    }

    private handlePing(port: any, id: string) {
        port.postMessage(new ExtensionResponse(MessageType.PING, id));
    }

    private getCookies(url: string) {
        return new Promise((resolve) => {
            chrome.cookies.getAll({ url }, cookies => {
                resolve(cookies);
            });
        });
    }
}

class RequestHandler {

}
// endregion

// region chrome handler
{
    chrome.runtime.onConnectExternal.addListener(port => {
        console.debug('adding onConnect listener', port);
        console.debug('port is connected');
        let messageHandler = new MessageHandler();
        port.onMessage.addListener(message => {
            console.debug('port.onMessage', message);
            messageHandler.onMessageReceived(message, port);
        });
    });

    chrome.runtime.onInstalled.addListener(details => {
        console.log('previousVersion', details.previousVersion);
    });

    chrome.webRequest.onBeforeSendHeaders.addListener(
        function (details) {
            // console.debug('details:', details);
            let requestHeaders = details.requestHeaders;
            if (!_.isEmpty(requestHeaders)) {
                let rsHeader = _.find(requestHeaders, header => header.name === HEADER_KEY);
                if (rsHeader) {
                    console.debug('before headers', requestHeaders);
                    _.pull(requestHeaders, rsHeader);
                    let headers = HEADER_REPO[rsHeader.value];
                    if (!_.isEmpty(headers)) {
                        _.keys(headers, name => {
                            requestHeaders.push({ name, value: headers[name] });
                        });
                    }
                    console.debug('actual headers', requestHeaders);
                }
            }

            return { requestHeaders };
        },
        { urls: ['<all_urls>'] },
        ['blocking', 'requestHeaders']
    );

    console.log('Chrome Listeners are set up ......');
}
// endregion

// region type definition
enum MessageType {
    PING = <any> 'PING',
    HTTP_REQUEST = <any> 'HTTP_REQUEST'
}

class ExtensionMessage {
    id: string;
    type: MessageType;
    payload: any;
}

class HttpRequest {
    url: string;
}

class ExtensionResponse {
    public id: string;
    public type: MessageType;
    public payload: any;

    constructor(type: MessageType, id?: string, payload?: any) {
        this.type = type;
        this.id = id;
        this.payload = payload;
    }
}

interface HttpRequestPayload {
    options: any;
    request: HttpRequest; // for form, binary data
}

interface HttpResponsePayload {
    response: any;
    error: any;
    cookies: any[];
    timeSpan: TimeSpan;
}

interface TimeSpan {
    start: number;
    end: number;
}
// endregion