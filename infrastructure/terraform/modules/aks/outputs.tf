# Output definitions for Azure Kubernetes Service (AKS) module
# Provider version: azurerm ~> 3.0

# Basic cluster identification outputs
output "cluster_name" {
  description = "The name of the AKS cluster for reference in dependent resources and configurations"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_id" {
  description = "The fully qualified resource ID of the AKS cluster for Azure RBAC and policy assignments"
  value       = azurerm_kubernetes_cluster.main.id
}

# Sensitive cluster access configuration
output "kube_config" {
  description = "Raw kubeconfig content for cluster authentication and access configuration"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

# Cluster identity information for RBAC
output "cluster_identity" {
  description = "System-assigned managed identity details including principal ID and tenant ID for RBAC assignments"
  value       = azurerm_kubernetes_cluster.main.identity
}

# Networking configuration outputs
output "cluster_fqdn" {
  description = "Fully Qualified Domain Name of the AKS cluster for DNS and networking configuration"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

# Resource management outputs
output "node_resource_group" {
  description = "Name of the auto-generated resource group containing AKS cluster nodes and resources"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}

# Version information for compatibility
output "kubernetes_version" {
  description = "Version of Kubernetes running in the AKS cluster for compatibility verification"
  value       = azurerm_kubernetes_cluster.main.kubernetes_version
}