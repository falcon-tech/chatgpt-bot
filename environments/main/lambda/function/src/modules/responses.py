# 必要なモジュールをインポート
import os
import boto3
import httpx
from base64 import b64decode
from openai import OpenAI

# OpenAI APIキーの設定
## ローカル実行の場合は環境変数に設定されたAPIキーを使用
if os.environ["ENV"] == "local":
    OPENAI_API_KEY = os.environ['OPENAI_API_KEY']
## 本番実行の場合はKMSを使用して環境変数を復号化したAPIキーを使用
else:
    OPENAI_API_KEY = boto3.client('kms').decrypt(
        CiphertextBlob=b64decode(os.environ['OPENAI_API_KEY']),
        EncryptionContext={'LambdaFunctionName': os.environ['AWS_LAMBDA_FUNCTION_NAME']}
    )['Plaintext'].decode('utf-8')

# OpenAIクライアントの作成
## ローカル実行の場合はSSL検証を無効化
if os.environ.get("ENV") == "local":
    http_client = httpx.Client(
        verify=False
    )
    openai = OpenAI(api_key=OPENAI_API_KEY, http_client=http_client)
## 本番環境の場合は通常のSSL検証
else:
    openai = OpenAI(api_key=OPENAI_API_KEY)

# Responses APIを使用してメッセージを送信し、返信テキストとレスポンスIDを返す
def send_message(previous_response_id, message):
    try:
        # API呼び出しのパラメータを設定
        kwargs = {
            "model": os.environ["OPENAI_MODEL"],
            "input": message,
            "reasoning": {
                "effort": "minimal"
            }
        }
        # 前回のレスポンスIDが存在する場合は、引数に追加
        if previous_response_id:
            kwargs["previous_response_id"] = previous_response_id
        # OpenAI Responses APIを呼び出し
        response = openai.responses.create(**kwargs)
        # レスポンスのoutput配列からtype='message'の要素を探す
        for output in response.output:
            if output.type == 'message':
                # content配列からtype='output_text'の要素を探して、textを取得
                for content in output.content:
                    if content.type == 'output_text':
                        reply_text = content.text
                        break
                break
        # レスポンスIDを取得
        response_id = response.id
        # ログ出力
        print("Response id: " + str(response_id))
        print("Response messages: " + reply_text)
        print("Successfully sent message to OpenAI")
        # 返信テキストとレスポンスIDを返却
        return reply_text, response_id
    except Exception as e:
        print("Error sending message to OpenAI: " + str(e))
        raise e