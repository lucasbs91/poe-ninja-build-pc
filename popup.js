let statsJson;
let ignoredImplicits;

let itemsList = [];
let flasksList = [];
let jewelsList = [];
let skillsList = [];

// TODO: fix
/*
getStatusByModAndType Allocates Berserker if you have the matching modifier on Forbidden Flesh
Allocates # if you have matching modifier on Forbidden Flesh
OR
Allocates # if you have matching modifier on Forbidden Flame
*/

const onlineOption = document.getElementById("onlineOption");
const anyOption = document.getElementById("anyOption");
const checkPriceButton = document.getElementById("checkPrice");
const csvDownload = document.getElementById("downloadCSV");
const avgBuildPrice = document.getElementById("avgBuildPrice");

const itemsListDOM = document.getElementById("itemsList");
const skillsListDOM = document.getElementById("skillsList");
const flasksListDOM = document.getElementById("flasksList");
const jewelsListDOM = document.getElementById("jewelsList");

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.windows.getCurrent({ populate: true }, (windowInfo) => {
      const activeTab = windowInfo.tabs.find((tab) => tab.active);
      resolve(activeTab);
    });
  });
}

function extractAccountAndNameAndOverviewAndType(url) {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');

    // Find the account, name, and overview based on URL structure
    let account = '';
    let name = '';
    let overview = '';
    let type = 'exp';

    if (pathSegments.includes('character')) {
      const characterIndex = pathSegments.indexOf('character');
      if (characterIndex < pathSegments.length - 2) {
        account = pathSegments[characterIndex + 1];
        name = pathSegments[characterIndex + 2];
      }
    }

    // Extract the overview from the pathSegments
    const overviewIndex = pathSegments.indexOf('builds');
    if (overviewIndex >= 0 && overviewIndex < pathSegments.length - 1) {
      overview = pathSegments[overviewIndex + 1];
    }

    if (overview == 'streamers') {
      type = 'streamers'
    }

    return { account, name, overview, type };
  } catch (error) {
    console.error('Error extracting account, name, and overview:', error);
    return { account: '', name: '', overview: '', type: '' };
  }
}

async function getSnapshotVersionAndSnapshotName(overview) {
  try {
    const response = await fetch("https://poe.ninja/api/data/getindexstate");
    const data = await response.json();

    // Find the correct snapshot by matching the "url"
    const snapshot = data.snapshotVersions.find((version) => {
      return version.url === overview;
    });

    console.log('snapshot', snapshot);

    if (snapshot) {
      return { version: snapshot.version, snapshotName: snapshot.snapshotName };
    } else {
      console.error('Snapshot not found for the current URL.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    return null;
  }
}

async function sendCmd(cmd, searchParams) {
  const tab = await getCurrentTab();

  if (tab) {
    const url = tab.url;
    console.log('URL:', url);

    const { account: account, name: name, overview: overview, type: type } = extractAccountAndNameAndOverviewAndType(url);

    const { version, snapshotName } = await getSnapshotVersionAndSnapshotName(overview);
    console.log('Snapshot Version:', version);
    console.log('Snapshot Name:', snapshotName);

    if (version !== null) {
      // Construct the API URL using the extracted information and the obtained version
      const apiUrl = `https://poe.ninja/api/data/${version}/getcharacter?account=${account}&name=${name}&overview=${snapshotName}&type=${type}`;

      // Make a request to the API URL
      fetch(apiUrl)
        .then((response) => response.json())
        .then((data) => {
          // Handle the API response here
          console.log('API Response:', data);
          checkBuildPrice(data, data.league);
        })
        .catch((error) => {
          console.error('API Request Error:', error);
        });
    }
  }
}

function extractNumberFromString(inputString) {
  // Define a regular expression to match numbers (including decimals)
  const regex = /-?\d+(\.\d+)?/;

  // Use the regex to find the first number in the inputString
  const match = inputString.match(regex);

  // Check if a match was found
  if (match) {
    // Convert the matched string to a number
    const number = parseFloat(match[0]);

    // Check if the conversion was successful
    if (!isNaN(number)) {
      return number;
    }
  }

  // Return null if no valid number was found
  return null;
}

async function checkBuildPrice(data, league) {
  for (const item of data.items) {
    await checkItemPrice(item, league, itemsListDOM);
  }

  for (const skill of data.skills) {
    await checkSkillPrice(skill.allGems, league, skillsListDOM);
  }

  for (const flask of data.flasks) {
    await checkItemPrice(flask, league, flasksListDOM);
  }

  for (const jewel of data.jewels) {
    await checkItemPrice(jewel, league, jewelsListDOM);
  }

  avgBuildPrice.textContent = "TODO: show total price";
  console.log('itemsList',itemsList);
  csvDownload.disabled = false;
}

async function checkSkillPrice(allGems, league, dom) {
  let onlineSelected = document.querySelector('input[type="radio"]:checked').value;

  for (let gem of allGems) {

    if (!gem.itemData) continue;

    let discriminator = null;
    if (gem.name.includes("Anomalous")) discriminator = "Anomalous";
    else if (gem.name.includes("Divergent")) discriminator = "Divergent";
    else if (gem.name.includes("Phantasmal")) discriminator = "Phantasmal";

    let typeObject;

    if (!discriminator) {
      typeObject = gem.name;
    } else {
      typeObject = {
        discriminator: discriminator.toLowerCase(),
        option: gem.name.replace(discriminator + " ", "")
      };
    }

    let payload = {
      query: {
        status: {
          option: onlineSelected,
        },
        type: typeObject,
        filters: {
          misc_filters: {
            filters: {
              corrupted: {
                option: gem.itemData?.corrupted,
              },
              gem_level: {
                min: gem.level
              },
              quality: {
                min: gem.quality
              }
            },
          },
        },
        stats: [
          {
            type: "and",
            filters: [],
          },
        ],
      },
      sort: {
        price: "asc",
      },
    };

    await fetchAndProcessData(payload, league, dom, gem.itemData);
  }
}

async function checkItemPrice(item, league, dom) {
  let currentItem = item.itemData;
  let onlineSelected = document.querySelector('input[type="radio"]:checked').value;
  console.log('currentItem', currentItem);

  let payload = {
    query: {
      status: {
        option: onlineSelected,
      },
      type: currentItem.baseType,
      filters: {
        misc_filters: {
          filters: {
            corrupted: {
              option: currentItem.corrupted,
            },
          },
        },
      },
      stats: [
        {
          type: "and",
          filters: [],
        },
      ],
    },
    sort: {
      price: "asc",
    },
  };

  // If it's an unique item
  if (currentItem.frameType == 3) {
    payload.query.name = currentItem.name;
  }

  if (currentItem.implicitMods.length > 0) {
    currentItem.implicitMods.forEach((mod) => {
      let id = getStatusByModAndType(mod, "implicit").id;
      let disabled = false;
      if (ignoredImplicits.includes(id)) {
        disabled = true;
      }
      payload.query.stats[0].filters.push({ id: id, disabled: disabled });
    });
  }

  if (currentItem.fracturedMods.length > 0) {
    currentItem.fracturedMods.forEach((mod) => {
      let filterObject = extractModAndValue(mod, "fractured");

      payload.query.stats[0].filters.push(filterObject);
    });
  }

  if (currentItem.explicitMods.length > 0) {
    currentItem.explicitMods.forEach((mod) => {
      let filterObject = extractModAndValue(mod, "explicit");

      // Push the created object to the filters array
      payload.query.stats[0].filters.push(filterObject);
    });
  }

  await fetchAndProcessData(payload, league, dom, currentItem);
}

async function fetchAndProcessData(payload, league, dom, currentItem) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      getRequest(payload, league)
        .then(async (response) => {
          console.log('marketResponse', response)
          let poeTradeLink = 'https://www.pathofexile.com/trade/search/' + league + '/' + response.id;

          if (response.marketResponse.result) {
            let item = {
              poeTradeLink: poeTradeLink,
              name: response.marketResponse.result[0].item.name,
              icon: response.marketResponse.result[0].item.icon,
              minAndMaxPrice: `${response.marketResponse.result[0].listing.price.amount} ${response.marketResponse.result[0].listing.price.currency} to ${response.marketResponse.result[response.marketResponse.result.length-1].listing.price.amount} ${response.marketResponse.result[response.marketResponse.result.length-1].listing.price.currency}`,
              priceList: response.marketResponse.result.map((item) => ({
                price: item.listing.price.amount,
                currency: item.listing.price.currency
              }))
            };
            console.log('item', item)
            console.log('-------------------------------------------------- Item Market Price Response:', item.minAndMaxPrice);
            console.log('-------------------------------------------------- https://www.pathofexile.com/trade/search/' + league + '/' + response.id);
            itemsList.push(item);

            domAppend(dom, currentItem, item.minAndMaxPrice, poeTradeLink);
          } else { // NOT FOUND
            let item = {
              poeTradeLink: poeTradeLink,
              name: currentItem.name,
              icon: currentItem.icon
            };
            itemsList.push(item);
            domAppend(dom, currentItem, 'No Results Found', poeTradeLink);
          }

          resolve(); // Resolve the Promise to continue to the next item
        })
        .catch((error) => {
          console.error('Error:', error);
          resolve(); // Resolve the Promise even if there's an error to continue to the next item
        });
    }, 5000); // Wait for X seconds before making the next request
  });
}

function extractModAndValue(mod, type) {
  let entry = getStatusByModAndType(mod, type);
  let id = entry.id;

  // Create the object to be added to the array conditionally
  const filterObject = {
    id: id,
    disabled: false,
  };

  // If entry has value
  if (entry.option) {
    let option = entry.option.options.filter(item => mod.includes(item.text));
    filterObject.value = {
      option: option[0].id
    }
  }


  // Check if status includes '#' and set the property accordingly
  let min = extractNumberFromString(mod);
  if (mod == 'Kill Enemies that have 15% or lower Life on Hit if The Searing Exarch is dominant') min = 1; // bug?
  console.log('min',min)
  if (/\d/.test(mod)) {
    // items that uses 'increase' with max negative values
    if (
      mod.includes("Commanded leadership over") ||
      mod.includes("Denoted service of")
    ) {
      filterObject.value = {
        max: min,
        min: min
      };
    } else if (entry.invert) {
      filterObject.value = {
        max: min * -1
      };
    } else {
      filterObject.value = {
        min: min
      };
    }
  }

  return filterObject;
}

function domAppend(domElement, item, price, poeTradeLink) {
  // Create the outer div to contain the entire item
  const outerDiv = document.createElement('div');

  // Create outer div for the img
  const outerImgDiv = document.createElement('div');
  outerImgDiv.className = "imgDiv";
  // Create an image element and set its source
  const img = document.createElement('img');
  img.src = item.icon;

  // Create a nested div to hold the name, price range, and link
  const innerDiv = document.createElement('div');

  // Create a div for the name
  const divName = document.createElement('div');
  divName.textContent = 'Name: ' + item.name.length > 0 ? item.name : item.typeLine;

  // Create a div for the price range
  const divPriceRange = document.createElement('div');
  divPriceRange.textContent = 'Price Range: ' + price;

  // Create a link element
  const a = document.createElement('a');
  a.textContent = poeTradeLink;
  a.href = '#'; // Set a placeholder href to prevent the link from navigating
  a.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent the default click behavior (navigation)
    chrome.tabs.create({ url: poeTradeLink, active: false });
  });

  // Append the elements to build the hierarchy
  outerImgDiv.appendChild(img);
  outerDiv.appendChild(outerImgDiv);
  innerDiv.appendChild(divName);
  innerDiv.appendChild(divPriceRange);
  innerDiv.appendChild(a);
  outerDiv.appendChild(innerDiv);

  // Finally, append the entire item to itemsListDOM
  domElement.appendChild(outerDiv);
}

async function getRequest(payload, league) {
  try {
    const response = await fetch("https://www.pathofexile.com/api/trade/search/" + league, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    return { marketResponse: await getItemMarketPrice(data), id: data.id};
  } catch (error) {
    console.error('Error fetching item market price:', error);
    return null;
  }
}

async function getItemMarketPrice(data) {
  const apiUrl = `https://www.pathofexile.com/api/trade/fetch/${data.result.slice(0, 10).join(',')}?query=${data.id}`
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      // throw new Error(`Request failed with status ${response.status}`);
      console.error(`Request failed with status ${response.status}`);
      return 'No results found';
    }

    const responseData = await response.json();
    return responseData;
    // return `${responseData.result[0].listing.price.amount} ${responseData.result[0].listing.price.currency} to ${responseData.result[responseData.result.length-1].listing.price.amount} ${responseData.result[responseData.result.length-1].listing.price.currency}`
  } catch (error) {
    console.error('API Request Error:', error);
    return 'Failed';
  }
}

function replaceNumbersWithPlaceholder(input) {
  // Use a regular expression to find numeric values
  const regex = /\b\d+(\.\d+)?\b/g;

  // Replace numeric values with '#'
  const replacedText = input.replace(regex, '#');

  return replacedText;
}

function removeContentInBrackets(inputString) {
  // Define a regular expression to match content within parentheses
  const regex = /\([^)]*\)/g;

  // Use the replace method to remove all matched content within parentheses
  const resultString = inputString.replace(regex, '');

  return resultString.trim(); // Trim any leading/trailing whitespace
}

function findSimilarString(original, modified) {
  const similarityThreshold = 0.92;
  
  // Split the strings into words for comparison
  const originalWords = original.split(' ');
  const modifiedWords = modified.split(' ');

  // Calculate the minimum length of the two strings
  const minLength = Math.min(originalWords.length, modifiedWords.length);

  // Count the number of matching words
  let matchingWords = 0;

  for (let i = 0; i < minLength; i++) {
    if (originalWords[i] === modifiedWords[i]) {
      matchingWords++;
    }
  }

  // Calculate the similarity ratio based on matching words and total words
  const similarityRatio = matchingWords / originalWords.length;

  // Check if the similarity ratio exceeds the threshold
  if (similarityRatio >= similarityThreshold) {
    return true;
  } else {
    return false;
  }
}

function getStatusByModAndType(mod, type) {
  let placeholderMod = replaceNumbersWithPlaceholder(mod);
  placeholderMod = placeholderMod.replaceAll('-#', '+#');
  console.log('getStatusByModAndType',placeholderMod);
  console.log('type',type);

  let result = statsJson.result.find(item => item.id === type);

  if (placeholderMod.includes("Only affects Passives in ") && placeholderMod.includes("Ring")) {
    placeholderMod = "Only affects Passives in # Ring";
  } else if (placeholderMod.includes("Passives in Radius of") && placeholderMod.includes("without being connected to your tree")) {
    placeholderMod = "Passives in Radius of # can be Allocated\nwithout being connected to your tree";
  } else if (
    placeholderMod.includes("Commanded leadership over") ||
    placeholderMod.includes("Denoted service of")
  ) {
    placeholderMod = placeholderMod.substring(0, placeholderMod.indexOf('\n'));
  }

  let entry = result.entries.filter(entry => removeContentInBrackets(entry.text) === placeholderMod);
  console.log('entry',entry);

  // Not found, check for exceptions
  if (entry.length == 0) {
    entry = result.entries.filter(entry => findSimilarString(removeContentInBrackets(entry.text), placeholderMod));
    console.log('matched entry',entry);
  }

  if (entry.length == 0) {
    console.error('item not found on the database');
    return '';
  }
  return entry[0];
}

function loadJsons() {
  fetch('stats.json')
    .then(response => response.json())
    .then(result => {
      statsJson = result;
    })
    .catch(error => {
      console.error('Error fetching stats JSON:', error);
    });

  fetch('ignoredImplicits.json')
    .then(response => response.json())
    .then(result => {
      ignoredImplicits = result;
    })
    .catch(error => {
      console.error('Error fetching ignored implicits JSON:', error);
    });
}

const csvmaker = function (data) {
  let csvRows = new Array();
  const headers = Object.keys(data[0]);
  // csvRows.push(headers.join(','));
  csvRows.push('PoeTradeLink, Name, Price');
  
  for (const row of data) {
    const values = [
      row['poeTradeLink'],
      row['name'] || getNameFromURL(row['icon']),
      row['minAndMaxPrice']
    ];
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

function getNameFromURL(url) {
  return url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.'));
}

checkPriceButton.addEventListener('click', async function (evt) {
  checkPriceButton.disabled = true;
  evt.preventDefault(); // Prevents `submit` event from reloading the popup
  const result = await sendCmd("checkPrice", {});
  // console.log('Item Market Price Response2:', result);
});

csvDownload.addEventListener('click', async function (evt) {
  if (csvDownload.disabled) return;
  evt.preventDefault();
  
  console.log("Downloading...")
  const blob = new Blob([csvmaker(itemsList)], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.setAttribute('href', url)
  a.setAttribute('download', `build.csv`);
  a.click()
});

loadJsons();
