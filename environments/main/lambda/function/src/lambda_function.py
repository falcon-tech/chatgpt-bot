# 必要なモジュールをインポート
import os
import modules.responses as responses
import modules.line as line
import modules.slack as slack
import modules.dynamodb as dynamodb

# メインのLambdaハンドラー関数
def lambda_handler(event, context):
    try:
        print("Received event: " + str(event))
        # イベントタイプによる処理の分岐
        if "destination" in event:
            # LINEからのメッセージの場合
            print("Received messages from LINE")
            line_handler(event)
        elif event["type"] == "url_verification":
            # SlackのURL検証の場合、チャレンジトークンを返却
            print("Received url verification from Slack")
            return event["challenge"]
        elif event["type"] == "event_callback":
            # Slackからのイベントコールバックの場合
            print("Received messages from Slack")
            slack_handler(event)
        else:
            # 予期しないソースからのメッセージ
            print("Received messages from an unexpected source:")
        print("Successfully processed Lambda event")
    except Exception as e:
        print("Error processing Lambda event: " + str(e))
        raise e

# LINEからのメッセージを処理する関数
def line_handler(event):
    try:
        # イベント内のメッセージを順次処理
        for event in event["events"]:
            # テキストメッセージの場合
            if event["type"] == "message" and event["message"]["type"] == "text":
                # メッセージ情報を取得
                message_obj = event["message"]
                source = event.get("source", {})
                message = message_obj["text"]
                mention = message_obj.get("mention")
                # 指定されたユーザーIDまたはグループID以外からのメッセージの場合は処理を終了
                is_allowed_user = source.get("userId") == os.environ.get("LINE_USER_ID")
                is_allowed_group = source.get("groupId") == os.environ.get("LINE_GROUP_ID")
                if not (is_allowed_user or is_allowed_group):
                    print("Skipping message because it is not from the allowed user or group")
                    continue
                # ソースタイプがグループの場合
                if source.get("type") == "group":
                    # メンションチェックの有無(デフォルトは有効）
                    require_mention = os.environ.get("LINE_REQUIRE_MENTION_IN_GROUP", "true").lower() == "true"
                    # メンションチェックが有効な場合は、ボットにメンションされているかチェック
                    if require_mention:
                        is_bot_mentioned = False
                        if mention and "mentionees" in mention:
                            for mentionee in mention["mentionees"]:
                                if mentionee.get("isSelf") == True:
                                    is_bot_mentioned = True
                                    # ボットへのメンションを発見時点で残りのメンションのチェックを終了
                                    break
                        if not is_bot_mentioned:
                            print("Skipping message because it is not a mention to the bot")
                            continue
                # ユーザーのメッセージをログに出力
                print("User message: " + message)
                # リプライトークンを取得
                reply_token = event["replyToken"]
                # グループIDがあるならグループID、なければユーザーIDを識別子として使用
                identifier = source.get("groupId") or source.get("userId")
                db_table_name = os.environ["DB_TABLE_NAME"]
                # DynamoDBから前回のレスポンスIDを取得(string or None)
                previous_response_id = dynamodb.get_previous_response_id(db_table_name, identifier)
                # メッセージと前回のレスポンスIDをLLMに送信し、返答を取得
                reply_text, response_id = responses.send_message(previous_response_id, message)
                # キーが存在する場合は、値を上書き。存在しない場合は、アイテムを新規作成
                dynamodb.put_previous_response_id(db_table_name, identifier, response_id)
                # メッセージ送信
                line.reply_message(reply_token, reply_text)
        print("Successfully processed LINE handler")
    except Exception as e:
        print("Error processing LINE handler: " + str(e))
        raise e

# Slackからのメッセージを処理する関数
def slack_handler(event):
    try:
        # イベント内容を取得
        event = event["event"]
        # アプリへのメンション（@ボット）で、かつ指定されたユーザーからのメッセージの場合
        if event["type"] == "app_mention" and event["user"] == os.environ["SLACK_USER_ID"]:
            # メッセージ情報を取得
            message = event["text"]
            print("User message: " + message)
            channel = event["channel"]
            slack_thread_ts = event.get("thread_ts") or event.get("event_ts")
            db_table_name = os.environ["DB_TABLE_NAME"]
            # DynamoDBから前回のレスポンスIDを取得(string or None)
            previous_response_id = dynamodb.get_previous_response_id(db_table_name, slack_thread_ts)
            # メッセージと前回のレスポンスIDをLLMに送信し、返答を取得
            reply_text, response_id = responses.send_message(previous_response_id, message)
            # キーが存在する場合は、値を上書き。存在しない場合は、アイテムを新規作成
            dynamodb.put_previous_response_id(db_table_name, slack_thread_ts, response_id)
            # LLMからの返答をslackに送信
            slack.send_message(channel, reply_text, slack_thread_ts)
        print("Successfully processed Slack handler")
    except Exception as e:
        print("Error processing Slack handler: " + str(e))
        raise e