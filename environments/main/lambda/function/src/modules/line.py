# 必要なモジュールをインポート
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

# LINEチャネルアクセストークンの設定
## 本番実行かつ暗号化が有効な場合はKMSを使用して環境変数を復号化したトークンを使用
if os.environ.get("ENV") == "prod" and os.environ.get("ENCRYPTION") == "true":
    LINE_CHANNEL_ACCESS_TOKEN = boto3.client('kms').decrypt(
        CiphertextBlob=b64decode(os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")),
        EncryptionContext={'LambdaFunctionName': os.environ.get("AWS_LAMBDA_FUNCTION_NAME")}
    )['Plaintext'].decode('utf-8')

## それ以外の場合は環境変数に設定されたトークンを使用
else:
    LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")

# LINE Bot APIの設定を初期化
configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)

# LINEにメッセージを返信する関数
def reply_message(reply_token, message):
    try:
        # LINE Bot APIクライアントを初期化してメッセージを送信
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            # リプライトークンを使用してテキストメッセージを返信
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    reply_token=reply_token,
                    messages=[TextMessage(text=message)]
                )
            )
        print("Successfully replied message to LINE")
    except Exception as e:
        print("Error replying message to LINE: " + str(e))
        raise e