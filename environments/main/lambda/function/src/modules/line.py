import os
import boto3
from base64 import b64decode
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage
)
from linebot.v3.webhooks import (
    MessageEvent,
    TextMessageContent
)

LINE_CHANNEL_ACCESS_TOKEN = boto3.client('kms').decrypt(
    CiphertextBlob=b64decode(os.environ['LINE_CHANNEL_ACCESS_TOKEN']),
    EncryptionContext={'LambdaFunctionName': os.environ['AWS_LAMBDA_FUNCTION_NAME']}
)['Plaintext'].decode('utf-8')

configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)
#configuration = Configuration(access_token=os.environ["LINE_CHANNEL_ACCESS_TOKEN"])

def reply_message(reply_token, message):
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message_with_http_info(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=message)]
            )
        )