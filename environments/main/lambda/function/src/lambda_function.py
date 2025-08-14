import os
import json
import logging
import modules.assistants as assistants
import modules.line as line
import modules.slack as slack
import modules.dynamodb as dynamodb

def lambda_handler(event, context):
    print("Received event: " + str(event))
    if "destination" in event:
        print("Received messages from LINE")
        line_handler(event)
    elif event["type"] == "url_verification":
        print("Received url verification from Slack")
        return event["challenge"]
    elif event["type"] == "event_callback":
        print("Received messages from Slack")
        slack_handler(event)
    else:
        print("Received messages from an unexpected source:")

def line_handler(event):
    for event in event["events"]:
        if event["type"] == "message" and event["message"]["type"] == "text" and event["source"]["userId"] == os.environ.get("LINE_USER_ID"):
            message = event["message"]["text"]
            print("User message: " + message)
            reply_token = event["replyToken"]
            user_id = event["source"]["userId"]
            db_table_name = os.environ["DB_TABLE_NAME"]

            assistant_thread_id = dynamodb.get_thread_id(db_table_name, user_id)
            if assistant_thread_id is None:
                print("No thread id found in DynamoDB")
                assistant_thread_id = assistants.create_threads()
                dynamodb.put_thread_id(db_table_name, user_id, assistant_thread_id)
            gpt_message = assistant_handler(assistant_thread_id, message)
            line.reply_message(reply_token, gpt_message)

def slack_handler(event):
    event = event["event"]
    if event["type"] == "app_mention" and event["user"] == os.environ["SLACK_USER_ID"]:
        message = event["text"]
        print("User message: " + message)
        channel = event["channel"]
        slack_thread_ts = event.get("thread_ts") or event.get("event_ts")
        db_table_name = os.environ["DB_TABLE_NAME"]

        assistant_thread_id = dynamodb.get_thread_id(db_table_name, slack_thread_ts)
        if assistant_thread_id is None:
            print("No thread id found in DynamoDB")
            assistant_thread_id = assistants.create_threads()
            dynamodb.put_thread_id(db_table_name, slack_thread_ts, assistant_thread_id)
        gpt_message = assistant_handler(assistant_thread_id, message)
        slack.send_message(channel, gpt_message, slack_thread_ts)

def assistant_handler(thread_id, message):
    run = assistants.create_runs(thread_id, message)
    if run.status == "requires_action":
        print("Requires Action")
    elif run.status == "completed":
        gpt_message = assistants.get_messages(thread_id)
        return gpt_message