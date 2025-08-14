import os
import boto3
from datetime import datetime, timedelta

client = boto3.client("dynamodb")
#client = boto3.client("dynamodb", endpoint_url="http://localhost:8000")

def put_thread_id(table_name, key, thread_id):
    ttl = str(int((datetime.now() + timedelta(days=int(os.environ["THREAD_ID_EXPIRATION_DATE"]))).timestamp()))
    client.put_item(
        TableName=table_name,
        Item={
             "key": {"S": key},
             "thread_id": {"S": thread_id},
             "ttl": {"N": ttl},
        }
)

def get_thread_id(table_name, key):
    response = client.get_item(
        TableName=table_name,
        Key={
            "key": {"S": key}
        }
    )
    if "Item" in response:
      thread_id = response["Item"]["thread_id"]["S"]

      return thread_id