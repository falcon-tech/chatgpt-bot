// Global Variables
const scriptProperties =
  PropertiesService.getScriptProperties().getProperties();
const OPENAI_API_KEY = scriptProperties.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = scriptProperties.OPENAI_ASSISTANT_ID;
const LINE_CHANNEL_ACCESS_TOKEN = scriptProperties.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_USER_ID = scriptProperties.LINE_USER_ID;
const GOOGLE_CUSTOMSEARCH_API_KEY =
  scriptProperties.GOOGLE_CUSTOMSEARCH_API_KEY;
const GOOGLE_CUSTOMSEARCH_ENGIN_ID =
  scriptProperties.GOOGLE_CUSTOMSEARCH_ENGIN_ID;
const CHATGPT_MODEL = "gpt-4-turbo";
const CHATGPT_MAX_TEMPERATURE = 0.3;
const CHATGPT_MAX_TOKENS = 1000;
const headers = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + OPENAI_API_KEY,
  "OpenAI-Beta": "assistants=v1",
};

// Test
function testDoPost() {
  const testEvent = {
    destination: "xxxxxxxxxx",
    events: [
      {
        type: "message",
        message: {
          type: "text",
          id: "14353798921116",
          text: "2023年のWBCのMVPは？",
        },
        timestamp: 1625665242211,
        source: {
          type: "user",
          userId: LINE_USER_ID,
        },
        replyToken: "757913772c4646b784d4b7ce46d12671",
        mode: "active",
        webhookEventId: "01FZ74A0TDDPYRVKNK77XKC3ZR",
        deliveryContext: {
          isRedelivery: false,
        },
      },
    ],
  };
  const payload = JSON.stringify(testEvent);
  const contentType = "application/json";
  const testHttpRequest = {
    postData: {
      contents: payload,
      type: contentType,
    },
  };
  doPost(testHttpRequest);
}

// Receive Event
function doPost(e) {
  console.log("Received request:", JSON.stringify(e, null, 2));
  const events = JSON.parse(e.postData.contents).events;
  events.forEach((event) => {
    if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.source.userId === LINE_USER_ID
    ) {
      handleMessageEvent(event);
    }
  });
  return;
}

// Message Handling
async function handleMessageEvent(event) {
  console.log("Handling message event:", JSON.stringify(event, null, 2));
  const cache = CacheService.getScriptCache();
  try {
    const userMessage = event.message.text;
    const replyToken = event.replyToken;
    let threadId = cache.get("threadId");
    let runId = "";
    let attempts = 0;
    const maxAttempts = 5;
    if (threadId) {
      console.log("Thread Id catched");
      runId = await createRun(threadId, userMessage);
    } else {
      console.log("Thread Id not catched");
      threadId = await createEmptyThreads();
      cache.put("threadId", threadId);
      runId = await createRun(threadId, userMessage);
    }
    do {
      let run = await checkRun(threadId, runId);
      let runStatus = run.status;
      if (runStatus === "completed") {
        const gptMessage = await getMessage(threadId);
        sendLineMessage(replyToken, gptMessage);
        break;
      } else if (runStatus === "requires_action") {
        let toolId = run.toolId;
        let functionName = run.functionName;
        switch (functionName) {
          case "googleSearch":
            const functionResponse = await googleSearch(
              run.functionArguments.query,
              run.functionArguments.numResults,
              GOOGLE_CUSTOMSEARCH_API_KEY,
              GOOGLE_CUSTOMSEARCH_ENGIN_ID
            );
            await submitToolRun(threadId, runId, toolId, functionResponse);
            break;
        }
        attempts++;
        continue;
      }
      break;
    } while (attempts < maxAttempts);
  } catch (error) {
    console.error("Error handling message event:", error);
  }
}

// Create Empty Threads in Assistant API
async function createEmptyThreads() {
  const apiUrl = "https://api.openai.com/v1/threads";
  const options = {
    method: "post",
    headers: headers,
    muteHttpExceptions: true,
  };
  const response = await UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  console.log("Create thread", responseJson.id);
  return responseJson.id;
}

// Create Run in Assistant API
async function createRun(threadId, message) {
  const apiUrl = `https://api.openai.com/v1/threads/${threadId}/runs`;
  const payload = {
    assistant_id: OPENAI_ASSISTANT_ID,
    model: CHATGPT_MODEL,
    additional_messages: [
      {
        role: "user",
        content: message,
      },
    ],
    temperature: CHATGPT_MAX_TEMPERATURE,
    max_completion_tokens: CHATGPT_MAX_TOKENS,
  };
  const options = {
    method: "post",
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const response = await UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  console.log("Create run", responseJson.id);
  return responseJson.id;
}

// Submit Tool Run in Assistant API
async function submitToolRun(threadId, runId, toolId, functionResponse) {
  const apiUrl = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`;
  const payload = {
    tool_outputs: [
      {
        tool_call_id: toolId,
        output: functionResponse,
      },
    ],
  };
  const options = {
    method: "post",
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(apiUrl, options);
  return;
}

// Chek Run in Assistant API
async function checkRun(threadId, runId) {
  let status = "";
  let attempts = 0;
  const maxAttempts = 10;
  const apiUrl = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`;
  const options = {
    method: "get",
    headers: headers,
    muteHttpExceptions: true,
  };
  do {
    Utilities.sleep(1000);
    response = await UrlFetchApp.fetch(apiUrl, options);
    responseJson = JSON.parse(response.getContentText());
    status = responseJson.status;
    if (status === "completed") {
      console.log("Run status:", status);
      return {
        status: status,
      };
    } else if (status === "requires_action") {
      let required_tool =
        responseJson.required_action.submit_tool_outputs.tool_calls[0];
      console.log("Run status:", status);
      console.log(required_tool);
      return {
        status: status,
        toolId: required_tool.id,
        functionName: required_tool.function.name,
        functionArguments: JSON.parse(required_tool.function.arguments),
      };
    }
    attempts++;
  } while (attempts < maxAttempts);
  console.log("Max attempts reached");
  status = "error";
  return {
    status: status,
  };
}

// Get Message in Assistant API
async function getMessage(threadId) {
  const limit = 1;
  const apiUrl = `https://api.openai.com/v1/threads/${threadId}/messages?limit=${limit}`;
  const options = {
    method: "get",
    headers: headers,
    muteHttpExceptions: true,
  };
  const response = await UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  const gptMessage = responseJson.data[0].content[0].text.value;
  console.log("Response message:", gptMessage);
  return gptMessage;
}

// Send Message to LINE
function sendLineMessage(replyToken, gptMessage) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + LINE_CHANNEL_ACCESS_TOKEN,
  };
  const postData = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: gptMessage,
      },
    ],
  };
  const options = {
    method: "post",
    headers: headers,
    payload: JSON.stringify(postData),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(url, options);
}
