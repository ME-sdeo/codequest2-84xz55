# Provider versions and configurations for CodeQuest platform
# Version: 1.0.0

terraform {
  required_version = ">= 1.0"

  required_providers {
    # Azure Resource Manager provider - version ~> 3.0
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }

    # Kubernetes provider - version ~> 2.0
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }

    # Helm provider - version ~> 2.0
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }

    # Random provider - version ~> 3.0
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Azure Resource Manager provider configuration
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
      soft_delete_retention_days      = 90
    }

    resource_group {
      prevent_deletion_if_contains_resources = true
    }

    virtual_machine {
      delete_os_disk_on_deletion = true
      graceful_shutdown         = true
    }

    api_management {
      purge_soft_delete_on_destroy           = false
      recover_soft_deleted_api_managements   = true
    }
  }

  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id
  use_msi         = true
  environment     = var.environment
  partner_id      = var.partner_id
  skip_provider_registration = false
}

# Kubernetes provider configuration
provider "kubernetes" {
  host = data.azurerm_kubernetes_cluster.main.kube_config.0.host

  client_certificate     = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
  client_key            = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "kubelogin"
    args        = ["get-token", "--login", "azurecli"]
  }
}

# Helm provider configuration
provider "helm" {
  kubernetes {
    host = data.azurerm_kubernetes_cluster.main.kube_config.0.host

    client_certificate     = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
    client_key            = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(data.azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
  }

  registry {
    url      = var.helm_repository_url
    username = var.helm_repository_username
    password = var.helm_repository_password
  }
}