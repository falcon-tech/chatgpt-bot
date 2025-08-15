# 必要なモジュールをインポート
import os
import boto3
from datetime import datetime, timedelta

# ローカル実行かどうかを判定
if os.environ["ENV"] == "local":
    # ローカル実行の場合はDynamoDB Localを使用
    client = boto3.client("dynamodb", endpoint_url="http://localhost:8000")
else:
    # 本番実行の場合は通常のDynamoDBを使用
    client = boto3.client("dynamodb")

# 前回のレスポンスIDをDynamoDBに保存する関数
def put_previous_response_id(table_name, key, previous_response_id):
    # TTLを現在時刻から設定した日数後に設定
    ttl = str(int((datetime.now() + timedelta(days=int(os.environ["THREAD_ID_EXPIRATION_DATE"]))).timestamp()))
    try:
        # DynamoDBにアイテムを保存
        client.put_item(
            TableName=table_name,
            Item={
                "key": {"S": key},
                "previous_response_id": {"S": previous_response_id},
                "ttl": {"N": ttl},
            }
        )
        print("Successfully put previous response id in DynamoDB")
    except Exception as e:
        print("Error putting previous response id in DynamoDB: " + str(e))
        raise e

# 前回のレスポンスIDをDynamoDBから取得する関数
def get_previous_response_id(table_name, key):
    try:
        # DynamoDBからキーでアイテムを取得
        response = client.get_item(
            TableName=table_name,
            Key={
                "key": {"S": key}
            }
        )
        # アイテムが存在する場合
        if "Item" in response:
            previous_response_id = response["Item"]["previous_response_id"]["S"]
            print("Found previous response id in DynamoDB: " + str(previous_response_id))
            return previous_response_id
        else:
            # アイテムが存在しない場合はNoneを返却
            print("No previous response id found in DynamoDB")
            return None
    except Exception as e:
        print("Error getting previous response id from DynamoDB: " + str(e))
        raise e