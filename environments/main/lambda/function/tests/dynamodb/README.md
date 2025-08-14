### create table
```
aws dynamodb create-table \
--table-name chatgpt-bot-threads \
--attribute-definitions \
AttributeName=key,AttributeType=S \
--key-schema \
AttributeName=key,KeyType=HASH \
--provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1 \
--endpoint-url http://localhost:8000
```

### enable ttl
```
aws dynamodb update-time-to-live --table-name chatgpt-bot-threads --time-to-live-specification "Enabled=true, AttributeName=ttl" --endpoint-url http://localhost:8000
```