// https://developer.chrome.com/docs/extensions/reference/
// https://developer.chrome.com/docs/extensions/reference/debugger/

let tabId = '';
const body = [];
const stringType = 'string';
const objectType = 'object';
const arrayType = 'array';

chrome.action.onClicked.addListener(function (tab) {
  // console.log("tab", tab);
  tabId = tab.id;

  if (tab.url.startsWith('http')) {
    chrome.debugger.attach({ tabId }, '1.2', function () {
      chrome.debugger.sendCommand({ tabId }, 'Network.enable', {}, function () {
        console.log('Network enabled');
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
      });
      chrome.debugger.sendCommand({ tabId }, 'Log.enable', {}, function () {
        console.log('Log enabled');
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
      });
      chrome.debugger.sendCommand({ tabId }, 'Runtime.enable', {}, function () {
        console.log('Runtime enabled');
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
      });
    });
  } else {
    console.log('Debugger can only be attached to HTTP/HTTPS pages.');
  }
});

chrome.debugger.onEvent.addListener(async function (source, method, params) {
  const isXHRType = params?.type === 'XHR';
  const isLogType = method === 'Log.entryAdded';
  const isConsoleType = method === 'Runtime.consoleAPICalled';
  const reqMethods = method === 'Network.requestWillBeSent';
  const resMethods = [
    'Network.responseReceived',
    'Network.dataReceived'
  ].includes(method);

  if (isLogType) {
    log('log', params?.entry?.url || '', params?.entry?.text);
  } else if (isConsoleType) {
    await getConsoleMessage(params?.args);
  } else if (isXHRType && reqMethods) {
    const request = params?.request;
    log(
      'request',
      request?.url,
      request?.postData ? JSON.parse(request.postData) : ''
    );
  } else if (isXHRType && resMethods && params?.requestId) {
    // get response body from request ID
    chrome.debugger.sendCommand(
      { tabId },
      'Network.getResponseBody',
      { requestId: params.requestId },
      function (response) {
        if (response?.body) {
          log('response', params?.response?.url, JSON.parse(response.body));
        }
      }
    );
  }
});

chrome.debugger.onDetach.addListener(async function (source, reason) {
  // format body to be downloaded as file
  const formattedBody = formatBody();
  const blob = new Blob([formattedBody], { type: 'application/json' });
  const base64 = await convertToBase64(blob);

  // download the file
  await chrome.downloads.download({
    url: base64,
    filename: getFilename()
  });
});

const log = (type, url, content) => {
  console.log(type, url, content);
  body.push({ type, url, body: content });
};

const formatBody = () => {
  const tab = '  ';
  const formattedBody = body.map((row, index) => {
    const isFirstRow = index === 0;
    return `${isFirstRow ? tab : `\n${tab}`}${JSON.stringify(row)}`;
  });

  return `[\n${formattedBody}\n]`;
};

const convertToBase64 = blob => {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });
};

const getFilename = () => {
  let filename = 'network_log_';
  const extension = '.json';
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const date = new Date().getDate();
  const hours = new Date().getHours();
  const minutes = new Date().getMinutes();
  const seconds = new Date().getSeconds();
  const milliseconds = new Date().getMilliseconds();

  return `${filename}${year}${month}${date}_${hours}${minutes}${seconds}_${milliseconds}${extension}`;
};

const getConsoleMessage = async args => {
  if (!args) {
    return;
  }

  args?.forEach(async arg => {
    if (arg.type === stringType && arg.value) {
      log('log', '', arg.value);
    }

    // if Array type will require to get properties
    else if (arg.type === objectType && arg.subtype === arrayType) {
      const properties = await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.getProperties',
        {
          objectId: arg?.objectId,
          ownProperties: true,
          generatePreview: true
        }
      );

      properties?.result?.forEach(property => {
        if (property?.value?.preview?.properties) {
          property.value.preview.properties?.forEach(previewProperty => {
            log('log', '', { [previewProperty.name]: previewProperty?.value });
          });
        }
      });
    }

    // object type can be get from the preview
    else if (arg.type === objectType && arg?.preview?.properties) {
      arg.preview.properties.forEach(property => {
        log('log', '', { [property.name]: property.value });
      });
    }
  });
};
