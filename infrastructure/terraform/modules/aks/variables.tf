# Required Variables
variable "cluster_name" {
  type        = string
  description = "Name of the AKS cluster"
  validation {
    condition     = length(var.cluster_name) >= 3 && length(var.cluster_name) <= 63 && can(regex("^[a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be between 3 and 63 characters and contain only alphanumeric characters and hyphens"
  }
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where AKS cluster will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where AKS cluster will be deployed"
}

# Kubernetes Configuration
variable "kubernetes_version" {
  type        = string
  description = "Version of Kubernetes to use for the cluster"
  default     = "1.25.0"
  validation {
    condition     = can(regex("^1\\.(2[5-9]|[3-9][0-9])\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.25.0 or higher for enterprise support"
  }
}

# Node Pool Configuration
variable "node_pool_count" {
  type        = number
  description = "Initial number of nodes in the default node pool"
  default     = 3
  validation {
    condition     = var.node_pool_count >= 3 && var.node_pool_count <= var.max_node_count
    error_message = "Node pool count must be at least 3 for high availability and not exceed max_node_count"
  }
}

variable "node_pool_vm_size" {
  type        = string
  description = "VM size for the default node pool"
  default     = "Standard_DS3_v2"
}

variable "min_node_count" {
  type        = number
  description = "Minimum number of nodes for auto-scaling"
  default     = 3
}

variable "max_node_count" {
  type        = number
  description = "Maximum number of nodes for auto-scaling"
  default     = 20
  validation {
    condition     = var.max_node_count >= var.min_node_count && var.max_node_count <= 100
    error_message = "Maximum node count must be between min_node_count and 100 for enterprise scaling"
  }
}

# Networking Configuration
variable "network_plugin" {
  type        = string
  description = "Network plugin to use for the cluster (azure or kubenet)"
  default     = "azure"
}

variable "network_policy" {
  type        = string
  description = "Network policy to use for the cluster"
  default     = "azure"
  validation {
    condition     = contains(["azure", "calico"], var.network_policy) && (var.environment == "prod" ? var.network_policy == "azure" : true)
    error_message = "Network policy must be 'azure' for production environment"
  }
}

variable "load_balancer_sku" {
  type        = string
  description = "SKU for the load balancer (basic or standard)"
  default     = "standard"
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# High Availability Configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for high availability"
  default     = ["1", "2", "3"]
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones required for high availability"
  }
}

# Node Pool Labels and Taints
variable "node_pool_labels" {
  type        = map(string)
  description = "Labels to apply to all nodes in the default node pool"
  default = {
    environment = "var.environment"
    app         = "codequest"
  }
}

variable "node_pool_taints" {
  type        = list(string)
  description = "Taints to apply to all nodes in the default node pool"
  default     = []
}

# Monitoring Configuration
variable "monitoring_enabled" {
  type        = bool
  description = "Enable Azure Monitor for containers"
  default     = true
  validation {
    condition     = var.environment == "prod" ? var.monitoring_enabled == true : true
    error_message = "Monitoring must be enabled in production environment"
  }
}

variable "log_analytics_workspace_id" {
  type        = string
  description = "Resource ID of the Log Analytics workspace for container monitoring"
}