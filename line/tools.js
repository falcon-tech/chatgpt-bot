async function googleSearch(query, numResults, apiKey, enginId) {
  console.log('Calling GoogleCustomSearch API with search word:', query, ',number:', numResults)
  const apiUrl = "https://www.googleapis.com/customsearch/v1"
  const params = {
    "q": query,
    "num": numResults,
    "key": apiKey,
    "cx": enginId
  };
  const response = await UrlFetchApp.fetch(apiUrl + "?q=" + params.q + "&num=" + params.num + "&key=" + params.key + "&cx=" + params.cx)
  const responseJson = JSON.parse(response.getContentText())
  const items = responseJson.items || []
  console.log('Search result of GoogleCustomSearch', items)
  const summarizedItems = items.map((item) => {
    const { title, link, snippet } = item
    return {
      title: title,
      link: link,
      snippet: snippet
    };
  });
  console.log('Search result(Summary) of GoogleCustomSearch', summarizedItems)
  return JSON.stringify(summarizedItems)
}