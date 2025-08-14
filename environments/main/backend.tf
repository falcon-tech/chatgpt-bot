terraform {
  backend "s3" {
    bucket  = "chatgpt-bot-tfstate"
    key     = "main/terraform.tfstate"
    encrypt = true
  }
}