// Global Variables
const scriptProperties =
  PropertiesService.getScriptProperties().getProperties();
const OPENAI_API_KEY = scriptProperties.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = scriptProperties.OPENAI_ASSISTANT_ID;
const SLACK_BOT_TOKEN = scriptProperties.SLACK_BOT_TOKEN;
const SLACK_CLIENT_ID = scriptProperties.SLACK_CLIENT_ID;
const VERIFICATION_TOKEN = scriptProperties.VERIFICATION_TOKEN;
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

// Receive Event
function doPost(e) {
  console.log("Received request:", JSON.stringify(e, null, 2));
  const event = JSON.parse(e.postData.contents);
  const params = JSON.parse(e.postData.getDataAsString());
  if (event.type === "url_verification") {
    return ContentService.createTextOutput(event.challenge);
  }
  if (
    event.event.type === "app_mention" &&
    event.event.user === SLACK_CLIENT_ID &&
    params.token == VERIFICATION_TOKEN
  ) {
    const messageId = event.event.client_msg_id;
    const cache = CacheService.getScriptCache();
    if (cache.get(messageId)) {
      return;
    }
    cache.put(messageId, true, 60);
    handleMessageEvent(event.event);
  }
  return;
}

// Message Handling
async function handleMessageEvent(event) {
  console.log("Handling message event:", JSON.stringify(event, null, 2));
  const property = PropertiesService.getScriptProperties();
  try {
    const userMessage = event.text;
    let threadId = "";
    let runId = "";
    let attempts = 0;
    const maxAttempts = 5;
    if (event.thread_ts != null) {
      threadId = property.getProperty(event.thread_ts);
      console.log("Use exist threads");
      runId = await createRun(threadId, userMessage);
    } else {
      console.log("Create empty threads");
      threadId = await createEmptyThreads();
      property.setProperty(event.ts, threadId);
      runId = await createRun(threadId, userMessage);
    }
    do {
      let run = await checkRun(threadId, runId);
      let runStatus = run.status;
      if (runStatus === "completed") {
        const gptMessage = await getMessage(threadId);
        sendSlackMessage(
          event.channel,
          gptMessage,
          event.thread_ts || event.ts
        );
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

// Send Message to Slack
function sendSlackMessage(channel, gptMessage, threadTs) {
  const url = "https://slack.com/api/chat.postMessage";
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + SLACK_BOT_TOKEN,
    },
    payload: JSON.stringify({
      channel: channel,
      text: gptMessage,
      thread_ts: threadTs,
    }),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(url, options);
}
