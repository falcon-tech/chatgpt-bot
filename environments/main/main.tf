module "dynamodb_table" {
  # Module
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"
  # Table Setting
  name         = "chatgpt-bot-threads"
  hash_key     = "key"
  billing_mode = "PAY_PER_REQUEST"
  attributes = [
    {
      name = "key"
      type = "S"
    }
  ]
  ttl_enabled        = true
  ttl_attribute_name = "ttl"
}

module "lambda_layer" {
  # Module
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.21.1"
  # Layer Setting
  layer_name          = "chatgpt-bot-python"
  description         = null
  create_layer        = true
  create_package      = true
  source_path         = "./lambda/layer"
  compatible_runtimes = ["python3.12"]
}

module "lambda_function" {
  # Module
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.21.1"
  # Basic information
  function_name            = "chatgpt-bot"
  description              = null
  package_type             = "Zip"
  create_package           = true
  recreate_missing_package = false
  runtime                  = "python3.12"
  handler                  = "lambda_function.lambda_handler"
  source_path              = "./lambda/function/src"
  layers = [
    module.lambda_layer.lambda_layer_arn
  ]
  architectures      = ["arm64"]
  create_role        = true
  role_name          = "lambda-chatgpt-bot-role"
  policy_name        = "lambda-chatgpt-bot-policy"
  attach_policy_json = true
  policy_json = jsonencode(
    {
      Version : "2012-10-17",
      Statement : [
        {
          Effect : "Allow",
          Action : [
            "dynamodb:GetItem",
            "dynamodb:PutItem"
          ]
          Resource : module.dynamodb_table.dynamodb_table_arn
        },
        {
          Effect : "Allow",
          Action : ["kms:Decrypt"]
          Resource : var.kms_key_arn
        }
      ]
  })
  # Advanced Setting
  cloudwatch_logs_retention_in_days = 7
  memory_size                       = 512
  timeout                           = 180
  kms_key_arn                       = var.kms_key_arn
  # Permission
  allowed_triggers                        = {}
  create_current_version_allowed_triggers = false
  # Environment Variables
  environment_variables = {
    OPENAI_MODEL              = "gpt-5"
    OPENAI_API_KEY            = var.openai_api_key
    LINE_USER_ID              = var.line_user_id
    LINE_CHANNEL_ACCESS_TOKEN = var.line_channel_access_token
    SLACK_USER_ID             = var.slack_user_id
    SLACK_BOT_TOKEN           = var.slack_bot_token
    DB_TABLE_NAME             = module.dynamodb_table.dynamodb_table_id
    THREAD_ID_EXPIRATION_DATE = 30
    ENV                       = "prod"
  }
  # Asynchronous
  create_async_event_config    = true
  maximum_event_age_in_seconds = 60
  maximum_retry_attempts       = 0
}

module "api_gateway" {
  # Module
  source = "../../modules/terraform-aws-apigateway"
  # Module argument
  name                = "chatgpt-bot"
  lambda_function_arn = module.lambda_function.lambda_function_arn
  integration_request_parameters = {
    # *note:Lambdaを非同期実行させる為のRequestHeader。SLACKにAPIGWのエンドポイントを登録する際は、コメントアウトすること
    "integration.request.header.X-Amz-Invocation-Type" = "'Event'"
  }
}
