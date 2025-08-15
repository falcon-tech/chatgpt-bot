# テスト環境のセットアップ

## ツールインストール
### python-lambda-local
```
pip install python-lambda-local
```

### lambdaで使用しているモジュールのインストール
```
pip install -r ../../layer/requirements.txt
```

### dynamodb-adminのインストール(任意)
```
npm install -g dynamodb-admin
```

## dynamodbの設定
### dynamodb-localの起動
```
docker-compose -f dynamodb/docker-compose.yml up -d
```

### ダミーのAWS認証情報を設定
```
aws configure --profile dummy
AWS Access Key ID [None]: dummy
AWS Secret Access Key [None]: dummy
Default region name [None]: ap-northeast-1
Default output format [None]:
```

### テーブル作成
```
aws dynamodb create-table \
--table-name chatgpt-bot-threads \
--attribute-definitions \
AttributeName=key,AttributeType=S \
--key-schema \
AttributeName=key,KeyType=HASH \
--provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1 \
--endpoint-url http://localhost:8000 \
--profile dummy
```

### TTLの有効化
```
aws dynamodb update-time-to-live --table-name chatgpt-bot-threads --time-to-live-specification "Enabled=true, AttributeName=ttl" --endpoint-url http://localhost:8000 --profile dummy
```

### dynamodb-adminの起動(任意)
```
dynamodb-admin --dynamo-endpoint=http://localhost:8000
```

## env.jsonの作成
中身は適宜設定する。

```
cp env.json.sample env.json
```

## slack.jsonの作成
中身は適宜設定する。

```
cp events/slack.json.sample events/slack.json
```

## line.jsonの作成
中身は適宜設定する。

```
cp events/line.json.sample events/line.json
```

# テスト実行
## slackのテスト
```
python-lambda-local -f lambda_handler ../src/lambda_function.py -e env.json events/slack.json
```

## lineのテスト
```
python-lambda-local -f lambda_handler ../src/lambda_function.py -e env.json events/line.json
```

## dynamodbのデータ確認
以下コマンドを実行後、ブラウザで「http://localhost:8001」にアクセスする。

```
dynamodb-admin --dynamo-endpoint=http://localhost:8000
```