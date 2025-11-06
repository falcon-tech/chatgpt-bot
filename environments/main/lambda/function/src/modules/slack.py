# 必要なモジュールをインポート
import os
import boto3
from base64 import b64decode
from slack_sdk import WebClient

# Slack Botトークンの設定
## 本番実行かつ暗号化が有効な場合はKMSを使用して環境変数を復号化したトークンを使用
if os.environ.get("ENV") == "prod" and os.environ.get("ENCRYPTION") == "true":
    SLACK_BOT_TOKEN = boto3.client('kms').decrypt(
        CiphertextBlob=b64decode(os.environ.get("SLACK_BOT_TOKEN")),
        EncryptionContext={'LambdaFunctionName': os.environ.get("AWS_LAMBDA_FUNCTION_NAME")}
    )['Plaintext'].decode('utf-8')

## それ以外の場合は環境変数に設定されたトークンを使用
else:
    SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")

# Slack Webクライアントを初期化
client = WebClient(token=SLACK_BOT_TOKEN)

# Slackにメッセージを送信する関数
def send_message(channel, message, thread_ts):
    try:
        # 指定されたチャンネルのスレッドにメッセージを投稿
        response = client.chat_postMessage(
            channel=channel,
            text=message,
            thread_ts=thread_ts
        )
        print("Successfully sent message to Slack")
    except Exception as e:
        print("Error sending message to Slack: " + str(e))
        raise e