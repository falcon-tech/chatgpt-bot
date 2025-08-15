# 必要なモジュールをインポート
import os
import boto3
from base64 import b64decode
from slack_sdk import WebClient

# ローカル実行かどうかを判定
if os.environ["ENV"] == "local":
    # ローカル実行の場合は環境変数をそのまま使用
    SLACK_BOT_TOKEN = os.environ["SLACK_BOT_TOKEN"]
else:
    # 本番実行の場合はKMSを使用して環境変数を復号化
    SLACK_BOT_TOKEN = boto3.client('kms').decrypt(
        CiphertextBlob=b64decode(os.environ['SLACK_BOT_TOKEN']),
        EncryptionContext={'LambdaFunctionName': os.environ['AWS_LAMBDA_FUNCTION_NAME']}
    )['Plaintext'].decode('utf-8')

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