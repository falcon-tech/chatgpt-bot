import os
import boto3
from base64 import b64decode
from slack_sdk import WebClient

SLACK_BOT_TOKEN = boto3.client('kms').decrypt(
    CiphertextBlob=b64decode(os.environ['SLACK_BOT_TOKEN']),
    EncryptionContext={'LambdaFunctionName': os.environ['AWS_LAMBDA_FUNCTION_NAME']}
)['Plaintext'].decode('utf-8')

client = WebClient(token=SLACK_BOT_TOKEN)
#client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])

def send_message(channel, message, thread_ts):
    response = client.chat_postMessage(
        channel=channel,
        text=message,
        thread_ts=thread_ts
    )