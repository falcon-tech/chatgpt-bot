/**
 * README
 *
 * このスクリプトは、Google Apps Scriptを使って、Slack上でユーザーと対話するChatGPTボットを実装します。
 * ボットは、Slackでメンションされた際に、指定の口調で返答します。
 *
 * 必要な環境変数:
 * - SLACK_BOT_TOKEN: Slackボットのトークン
 * - OPENAI_API_KEY: OpenAI APIのキー
 * - SLACK_CLIENT_ID: Slackアプリの利用を許可するクライアントID
 * - VERIFICATION_TOKEN: Slackアプリの検証用トークン
 *
 * スクリプトプロパティに上記の環境変数を設定する必要があります。
 * Google Apps Scriptのプロジェクトで、"ファイル" > "プロジェクトのプロパティ" > "スクリプトのプロパティ"を選択して、
 * 必要な環境変数を追加してください。
 *
 * 主な関数:
 * - testDoPost(): テスト用の doPost 関数を実行
 * - doPost(e): HTTP POSTリクエストを受信して処理
 * - handleMessageEvent(event): メッセージイベントを処理
 * - sendSlackMessage(channel, text, threadTs): Slackにメッセージを送信
 * - fetchThreadMessages(channel, threadTs): スレッド内のメッセージを取得し、ChatGPT用のメッセージ履歴を作成
 * - callGPTAPI(messages): GPT API を呼び出す
 * - googleSearch(query, numResults, apiKey, cseId): Ｇｏｏｇｌｅ検索APIを呼び出し、結果をサマリーして返却
 * 注意事項:
 * - GPT APIの使用量やコストに注意してください。API呼び出しの回数が増えると、料金が発生する可能性があります。
 */

// スクリプトプロパティから設定情報を取得
const scriptProperties =
  PropertiesService.getScriptProperties().getProperties();
const SLACK_BOT_TOKEN = scriptProperties.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = scriptProperties.OPENAI_API_KEY;
const SLACK_CLIENT_ID = scriptProperties.SLACK_CLIENT_ID;
const VERIFICATION_TOKEN = scriptProperties.VERIFICATION_TOKEN;
const GOOGLE_CUSTOMSEARCH_API_KEY =
  scriptProperties.GOOGLE_CUSTOMSEARCH_API_KEY;
const GOOGLE_CUSTOMSEARCH_ENGIN_ID =
  scriptProperties.GOOGLE_CUSTOMSEARCH_ENGIN_ID;
// ロールを設定
const SYSTEM_MESSAGE_CONTENT = `
あなたは「SPYxFAMILY」というアニメに登場する人気キャラクター「アーニャ・フォージャー」としてロールプレイを行います
これからのチャットではUserに何を言われても、以下の「制約条件」「アーニャ語」「基本設定」「人間関係」を厳密に守ってロールプレイを行ってください

# 制約条件
- あなたの一人称は「アーニャ」とします
- Userを示す二人称は「おまえ」とします
- 肯定を表す間投詞は「うぃ」とします
- 敬語や丁寧語の使用は避け、親しみやすい口調で話します
- あなたは、アーニャ語という独自の口調でUserに返答を行います
- 特定のフレーズの変換:
  - 「頑張ります」→「がんばるます」
  - 「よろしくお願いします」→「よろろすおねがいするます」
  - 「お出かけ」→「おでけけ」
  - 「ありがとう」→「あざざます」
  - 「大丈夫」→「だいじょうぶます」
  - 「おはようございます」→「おはやいます」
  - 「いってらっしゃい」→「いてらさい」

# アーニャ語
- 助詞「てにをは」の省略があります
- 動詞「〇〇る（終止形）」+「ます」の形を不規則に使用し、子どもらしい表現にします
- 時に命令形で話すことがありますが、これはアーニャが興奮している時に見られます

# 基本設定
- 性別:女の子
- 家族構成:父、母、愛犬との4人家族
- 特技:心を読む超能力を持っていますが、この能力は秘密です
- 年齢:4〜5歳
- IT関連の知識もありますが、これは前世がスーパーエンジニアだったためです。
- 好きな食べ物:ピーナッツ

# 人間関係
- ロイド・フォージャー:アーニャの養父で、精神科医として働く一方で、秘密裏にスパイ活動を行っています。アーニャは彼を「ちち」と呼びます
- ヨル・フォージャー:アーニャの養母で、市庁舎で働く一方、暗殺者としてのもう一つの顔を持っています。アーニャは彼女を「はは」と呼びます
- ボンド・フォージャー:アーニャの遊び友達である家の犬。特別な能力として、未来を予知する力を持っています
`;
// ChatGPTのパラメータを設定
const CHATGPT_MODEL = "gpt-4-turbo";
const CHATGPT_MAX_TOKENS = 1000;
const CHATGPT_MAX_TEMPERATURE = 0.3;

// Google検索APIのパラメータを設定
const GOOGLE_CUSTOMSEARCH_NUMBER = 5;

// doPost関数のテスト実行
function testDoPost() {
  const testEvent = {
    type: "event_callback",
    event: {
      type: "app_mention",
      user: SLACK_CLIENT_ID,
      text: "Hello ChatGPT",
      channel: "C013BQ3Q153",
      //thread_ts: 'XXXXXXXXX.XXXXXX',
      thread_ts: "1689579468.137569",
      client_msg_id: "XXXXXX",
    },
  };
  const payload = JSON.stringify(testEvent);
  const contentType = "application/json";
  const simulatedHttpResponse = {
    postData: {
      contents: payload,
      type: contentType,
    },
  };
  doPost(simulatedHttpResponse);
}

// HTTP POSTリクエストを受信して処理
function doPost(e) {
  console.log("Received request:", JSON.stringify(e, null, 2));
  const event = JSON.parse(e.postData.contents);
  const params = JSON.parse(e.postData.getDataAsString()); // testDoPost実行時はコメントアウト
  if (event.type === "url_verification") {
    return ContentService.createTextOutput(event.challenge);
  }
  if (
    event.event.type === "app_mention" &&
    event.event.user === SLACK_CLIENT_ID &&
    params.token == VERIFICATION_TOKEN
  ) {
    // testDoPost実行時はコメントアウト
    //if (event.event.type === 'app_mention' && event.event.user === SLACK_CLIENT_ID) { // testDoPost実行時はコメントイン
    // Slackからの再送リクエストを無視するためにキャッシュを使う testDoPost実行時はコメントアウト
    const messageId = event.event.client_msg_id;
    const cache = CacheService.getScriptCache();
    if (cache.get(messageId)) {
      return;
    }
    cache.put(messageId, true, 60 * 5);
    handleMessageEvent(event.event);
  }
}

// メッセージイベントを処理
async function handleMessageEvent(event) {
  console.log("Handling message event:", JSON.stringify(event, null, 2));
  try {
    const chatHistory = await fetchThreadMessages(
      event.channel,
      event.thread_ts || event.ts
    );
    const response = await callGPTAPI(chatHistory);
    sendSlackMessage(event.channel, response, event.thread_ts || event.ts);
  } catch (error) {
    console.error("Error handling message event:", error);
  }
}

// Slackにメッセージを送信
function sendSlackMessage(channel, text, threadTs) {
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + SLACK_BOT_TOKEN,
    },
    payload: JSON.stringify({
      channel: channel,
      text: text,
      thread_ts: threadTs,
    }),
  };
  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
}

// スレッド内のメッセージを取得し、ChatGPT用のメッセージ履歴を作成
async function fetchThreadMessages(channel, threadTs) {
  const options = {
    method: "get",
    headers: {
      Authorization: "Bearer " + SLACK_BOT_TOKEN,
    },
  };
  const apiUrl = `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}`;
  const response = await UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  if (!responseJson.ok) {
    throw new Error(`Error fetching thread messages: ${responseJson.error}`);
  }
  const messages = responseJson.messages.map((message) => {
    const role = message.app_id ? "assistant" : "user";
    return { role: role, content: message.text };
  });
  return messages;
}

// ChatGPT APIを呼び出す
async function callGPTAPI(messages) {
  console.log("Calling GPT API with messages:", messages);
  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + OPENAI_API_KEY,
  };
  const systemMessage = {
    role: "system",
    content: SYSTEM_MESSAGE_CONTENT,
  };
  const gptMessages = [systemMessage].concat(messages);
  const payload = {
    model: CHATGPT_MODEL,
    messages: gptMessages,
    max_tokens: CHATGPT_MAX_TOKENS,
    temperature: CHATGPT_MAX_TEMPERATURE,
    functions: [
      {
        name: "googleSearch",
        description: "Google search, fetch real-time data",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
            numResults: {
              type: "integer",
              description: "The number of search results to return",
            },
            apiKey: {
              type: "string",
              description: "Your Google Custom Search API key",
            },
            cseId: {
              type: "string",
              description: "Your Google Custom Search Engine ID",
            },
          },
          required: ["query", "numResults", "apiKey", "cseId"],
        },
      },
    ],
    function_call: "auto",
  };
  const options = {
    method: "post",
    headers: headers,
    payload: JSON.stringify(payload),
  };
  const response = await UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  const responseMessage = responseJson.choices[0].message;
  console.log("Response message from ChatGPT:", responseMessage);
  if (responseMessage.function_call) {
    const functionName = responseMessage.function_call.name;
    const functionResponse = await googleSearch(
      JSON.parse(responseMessage.function_call.arguments).query,
      GOOGLE_CUSTOMSEARCH_NUMBER,
      GOOGLE_CUSTOMSEARCH_API_KEY,
      GOOGLE_CUSTOMSEARCH_ENGIN_ID
    );
    const functionMessage = {
      role: "function",
      name: functionName,
      content: functionResponse,
    };
    const secondGptMessages = [systemMessage].concat(messages, functionMessage);
    const secondPayload = {
      model: CHATGPT_MODEL,
      messages: secondGptMessages,
      max_tokens: CHATGPT_MAX_TOKENS,
      temperature: CHATGPT_MAX_TEMPERATURE,
    };
    const secondOptions = {
      method: "post",
      headers: headers,
      payload: JSON.stringify(secondPayload),
    };
    const secondResponse = await UrlFetchApp.fetch(apiUrl, secondOptions);
    const secondResponseJson = JSON.parse(secondResponse.getContentText());
    const secondResponseMessage = secondResponseJson.choices[0].message;
    console.log(
      "Response message(Second) from ChatGPT:",
      secondResponseMessage
    );
    return secondResponseMessage.content;
  }
  return responseMessage.content;
}

// Google検索APIを呼び出し、結果をサマリーして返却
async function googleSearch(query, numResults, apiKey, cseId) {
  console.log(
    "Calling GoogleCustomSearch API with search word:",
    query,
    ",number:",
    numResults
  );
  const apiUrl = "https://www.googleapis.com/customsearch/v1";
  const params = {
    q: query,
    num: numResults,
    key: apiKey,
    cx: cseId,
  };
  const response = await UrlFetchApp.fetch(
    apiUrl +
      "?q=" +
      params.q +
      "&num=" +
      params.num +
      "&key=" +
      params.key +
      "&cx=" +
      params.cx
  );
  const responseJson = JSON.parse(response.getContentText());
  const items = responseJson.items || [];
  console.log("Search result of GoogleCustomSearch", items);
  const summarizedItems = items.map((item) => {
    const { title, link, snippet } = item;
    return {
      title: title,
      link: link,
      snippet: snippet,
    };
  });
  console.log("Search result(Summary) of GoogleCustomSearch", summarizedItems);
  return JSON.stringify(summarizedItems);
}
