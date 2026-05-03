variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "crewspace"
}

variable "force_delete" {
  description = "Force delete repository on destroy"
  type        = bool
  default     = false
}
