variable "name" {
  type = string
}

variable "lambda_function_arn" {
  type = string
}

variable "integration_request_parameters" {
  type    = map(string)
  default = {}
}