chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
        console.log("content.js1",request);
        console.log("content.js2",sender);
		console.log("content.js3",sendResponse);
		if(request.cmd) {
			if(request.cmd == "checkPrice") checkPrice(request.searchParams);
		}
		sendResponse({});
	}
);

// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     if (request.cmd) {
//         if (request.cmd == "checkPrice") {
//             // Send a message to the content script
//             console.log("content.js",request,sender,sendResponse);
//             chrome.scripting.executeScript({
//                 target: { tabId: sender.tab.id },
//                 function: function () {
//                     console.log("Logging from content script on the page");
//                 }
//             });
//         }
//     }
//     sendResponse({});
// });

chrome.runtime.onMessageExternal.addListener( (request, sender, sendResponse) => {
    console.log("Received message from " + sender + ": ", request);
    sendResponse({ received: true }); //respond however you like
});


const timer = ms => new Promise(res => setTimeout(res, ms));

let element;
let object = new Array();
let category = "";
let city = "";
let state = "";

const csvmaker = function (data) {
    let csvRows = new Array();
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));
    for (const row of data) {
        const values = headers.map(e => {
            return row[e]
        })
        csvRows.push(values.join(','))
    }
    return csvRows.join('\n')
}

function downloadData() {
    console.log("Downloading...")
    const blob = new Blob([csvmaker(object)], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `${category}.csv`);
    a.click()
}

function createJsonData() {
    if (!element) return;
    console.log("Exporting object...")
    const rawList = element.querySelectorAll("div[role='article']");
    rawList.forEach(item => {
        const link = item.querySelector("div[role='article']>a")?.getAttribute("href");
        const lat_long = link?.match(/!8m2!3d(.*?)!4d(.*?)!/);
        const newItem = {
            category: item.querySelector(".W4Efsd>.W4Efsd>span>span")?.textContent,
            name: item.querySelector(".qBF1Pd.fontHeadlineSmall")?.textContent?.replaceAll(",", ""),
            map_link: item.querySelector("div[role='article']>a")?.getAttribute("href").replaceAll(",", ""),
            latitude: lat_long && lat_long[1],
            longitude: lat_long && lat_long[2],
            address: item.querySelector(".W4Efsd>.W4Efsd>span:last-child>span:last-child")?.textContent?.replaceAll(",", "-"),
            city: city,
            state: state,
        }
        object.push(newItem);
    });
    console.log(object);
    downloadData();
}

async function scrapePage(searchParams) {
    element = document.querySelector("div[role='feed']");
    object = new Array();
    category = searchParams.category;
    city = searchParams.city;
    state = searchParams.state;

    let oldScrollHeight = 0;
    let loadingCount = 0;
    while (true) {
    	if (oldScrollHeight != element?.scrollHeight) {
    		loadingCount = 0;
    		oldScrollHeight = element.scrollHeight;
            element.scrollTop = element.scrollHeight;
    	} else {
    		console.log("Loading...")
    		if (loadingCount >= 5) break;
    		loadingCount++;
    	}
    	await timer(3000);
    }
    loading = document.querySelector("div[role='feed'] > div:not([class]) > div:not([role='article']) > div:empty");
    if (loading) {
    	alert("Sorry! Unexpected error occurred. Please, try again.");
    } else {
	    console.log("Finished");
	    createJsonData();
    }
}

async function checkPrice() {
    console.log("checkPrice")
    console.log(location.href)
}