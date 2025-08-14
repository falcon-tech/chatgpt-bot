provider "aws" {
  region = "ap-northeast-1"
  default_tags {
    tags = {
      created_by = "falcon"
      managed_by = "terraform"
    }
  }
}
