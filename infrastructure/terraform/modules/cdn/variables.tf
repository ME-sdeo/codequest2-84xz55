variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where CDN resources will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where the CDN profile will be deployed"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
}

variable "project_name" {
  type        = string
  description = "Project name used for resource naming conventions"
  default     = "codequest"
}

variable "origin_hostname" {
  type        = string
  description = "Hostname of the origin server where static content is hosted"
}

variable "cdn_sku" {
  type        = string
  description = "SKU for Azure CDN profile (Standard/Premium) - Premium recommended for enterprise performance requirements"
  default     = "Premium"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags to be applied to all CDN resources"
  default     = {
    managed_by = "terraform"
    service    = "cdn"
  }
}