module "s3_tfstate" {
  # Module meta argument
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "4.11.0"
  # Module argument
  bucket = "chatgpt-bot-tfstate"
}
