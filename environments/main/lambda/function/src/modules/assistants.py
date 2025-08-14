import os
import boto3
from base64 import b64decode
from openai import OpenAI

OPENAI_API_KEY = boto3.client('kms').decrypt(
    CiphertextBlob=b64decode(os.environ['OPENAI_API_KEY']),
    EncryptionContext={'LambdaFunctionName': os.environ['AWS_LAMBDA_FUNCTION_NAME']}
)['Plaintext'].decode('utf-8')

openai = OpenAI(api_key=OPENAI_API_KEY)
#openai = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

def create_threads():
    thread = openai.beta.threads.create()
    print("Create thread: " + thread.id)
    return thread.id

def create_runs(thread_id, message):
    run = openai.beta.threads.runs.create_and_poll(
        thread_id=thread_id,
        assistant_id=os.environ["OPENAI_ASSISTANT_ID"],
        additional_messages=[
            {
                "role": "user",
                "content": message
            }
        ]
    )
    print("Run status: " + run.status)
    return run

def get_messages(thread_id):
    messages = openai.beta.threads.messages.list(
        thread_id=thread_id,
        limit=1
    )
    message = messages.data[0].content[0].text.value
    print("Response messages: " + message)
    return message