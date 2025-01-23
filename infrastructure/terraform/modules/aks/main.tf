# Azure Kubernetes Service (AKS) Module
# Provider versions:
# azurerm ~> 3.0
# kubernetes ~> 2.0

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Main AKS cluster resource with enterprise-grade configuration
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  kubernetes_version  = var.kubernetes_version
  dns_prefix         = var.cluster_name
  sku_tier           = "Standard" # Enterprise-grade SLA

  # Default node pool configuration with high availability
  default_node_pool {
    name                         = "default"
    node_count                   = var.node_pool_count
    vm_size                      = var.node_pool_vm_size
    enable_auto_scaling          = true
    min_count                    = var.min_node_count
    max_count                    = var.max_node_count
    type                         = "VirtualMachineScaleSets"
    zones                        = [1, 2, 3] # Multi-zone deployment
    only_critical_addons_enabled = false
    os_disk_size_gb             = 128
    os_disk_type                = "Managed"
    max_pods                    = 110
    node_labels                 = var.node_pool_labels
    node_taints                 = var.node_pool_taints
    enable_node_public_ip       = false
    ultra_ssd_enabled          = false
    orchestrator_version       = var.kubernetes_version
  }

  # Managed identity for enhanced security
  identity {
    type = "SystemAssigned"
  }

  # Advanced networking configuration
  network_profile {
    network_plugin     = "azure"
    network_policy     = "calico"
    load_balancer_sku = "standard"
    outbound_type     = "loadBalancer"
    service_cidr      = "10.0.0.0/16"
    dns_service_ip    = "10.0.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
  }

  # Azure AD integration with RBAC
  azure_active_directory_role_based_access_control {
    managed                = true
    azure_rbac_enabled    = true
    admin_group_object_ids = ["${var.admin_group_object_ids}"]
  }

  # Container monitoring with Azure Monitor
  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  # Microsoft Defender for Containers
  microsoft_defender {
    enabled = true
  }

  # Azure Key Vault integration for secrets management
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # Auto-upgrade configuration
  automatic_channel_upgrade = "stable"
  
  # Maintenance window configuration
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [21, 22, 23]
    }
  }

  # Azure Policy for Kubernetes
  azure_policy_enabled = true

  # Additional security configurations
  api_server_access_profile {
    authorized_ip_ranges = ["0.0.0.0/0"] # Should be restricted in production
    enable_private_cluster = false
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "CodeQuest"
    CostCenter  = var.cost_center
    CreatedBy   = "Terraform"
  }

  lifecycle {
    prevent_destroy = true # Prevent accidental cluster deletion
    ignore_changes = [
      kubernetes_version, # Managed by automatic upgrades
      default_node_pool[0].orchestrator_version
    ]
  }
}

# Outputs for use in other modules
output "cluster_name" {
  value = azurerm_kubernetes_cluster.main.name
  description = "The name of the AKS cluster"
}

output "cluster_id" {
  value = azurerm_kubernetes_cluster.main.id
  description = "The ID of the AKS cluster"
}

output "kube_config_raw" {
  value = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive = true
  description = "Raw kubeconfig for cluster access"
}

output "cluster_identity" {
  value = azurerm_kubernetes_cluster.main.identity
  description = "System-assigned identity of the AKS cluster"
}

output "kubelet_identity" {
  value = azurerm_kubernetes_cluster.main.kubelet_identity
  description = "Kubelet identity of the AKS cluster"
}

output "node_resource_group" {
  value = azurerm_kubernetes_cluster.main.node_resource_group
  description = "Auto-generated resource group for cluster nodes"
}