const types = {};

chrome.devtools.inspectedWindow.getResources((resources) => {
  console.log("getResources", resources);
  resources.forEach((resource) => {
    if (!(resource.type in types)) {
      types[resource.type] = 0;
    }
    types[resource.type] += 1;
  });
  let result = `Resources on this page:
  ${Object.entries(types)
    .map((entry) => {
      const [type, count] = entry;
      return `${type}: ${count}`;
    })
    .join("\n")}`;
  let div = document.createElement("div");
  div.innerText = result;
  document.body.appendChild(div);
});

chrome.devtools.network.onRequestFinished.addListener(function (request) {
  //   console.log("onRequestFinished", request);

  if (request._resourceType === "xhr") {
    const req = request?.request;
    const res = request?.response;
    let reqString = `${req?.method} ${
      req?.url
    } ${req?.queryString.toString()} ${
      req?.postData?.text ? JSON.stringify(JSON.parse(req?.postData?.text)) : ""
    }`;
    let resString = `${res?.status} ${res?.statusText}`;

    console.log(
      req?.method,
      req?.url,
      req?.queryString,
      req?.postData?.text ? JSON.parse(req?.postData?.text) : ""
    );
    console.log(res?.status, res?.statusText, res);
  }
});
