# variable "kms_key_arn" {
#   type      = string
#   sensitive = true
# }

variable "openai_api_key" {
  type      = string
  sensitive = true
}

variable "line_user_id" {
  type      = string
  sensitive = true
}

variable "line_group_id" {
  type      = string
  sensitive = true
}

variable "line_channel_access_token" {
  type      = string
  sensitive = true
}

variable "slack_user_id" {
  type      = string
  sensitive = true
}

variable "slack_bot_token" {
  type      = string
  sensitive = true
}
