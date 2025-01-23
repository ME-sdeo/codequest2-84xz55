# CodeQuest

[![Build Status](https://dev.azure.com/codequest/pipeline/badge.svg)](https://dev.azure.com/codequest/pipeline)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/codequest/codequest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Security Status](https://img.shields.io/badge/security-monitored-green.svg)](https://security.codequest.com)
[![Code Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen.svg)](https://coverage.codequest.com)

CodeQuest is a Software-as-a-Service (SaaS) gamification platform that integrates with Azure DevOps (ADO) to enhance developer productivity and engagement through a points-based reward system. The platform automatically tracks and rewards development activities within ADO, providing real-time recognition for developer contributions.

## Key Features

- 🎮 Real-time activity tracking and point allocation
- 📊 Dynamic leaderboards and team rankings
- 🏆 Achievement system with customizable badges
- 🤖 AI-generated code detection and point adjustment
- 🔐 Enterprise-grade security with SSO support
- 📈 Comprehensive analytics and reporting
- 🌐 Multi-tenant architecture supporting 10,000+ companies

## Technology Stack

- **Frontend**: React 18+, TypeScript 5.0+
- **Backend**: Node.js 18+ LTS, Express 4.18+
- **Database**: PostgreSQL 14+, Redis 7+
- **Infrastructure**: Azure Kubernetes Service (AKS)
- **CI/CD**: Azure DevOps Pipelines
- **Monitoring**: Azure Monitor, Application Insights

## Prerequisites

- Node.js 18+ LTS
- npm 9+
- PostgreSQL 14+
- Redis 7+
- Azure subscription
- Docker 20+
- Kubernetes CLI (kubectl)
- Azure CLI

## Quick Start

```bash
# Clone the repository
git clone https://github.com/codequest/codequest.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development environment
npm run dev
```

## Getting Started

### Environment Setup

1. Install required dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   # Required environment variables
   DATABASE_URL=postgresql://user:password@localhost:5432/codequest
   REDIS_URL=redis://localhost:6379
   AZURE_TENANT_ID=your_tenant_id
   AZURE_CLIENT_ID=your_client_id
   AZURE_CLIENT_SECRET=your_client_secret
   ```

3. Initialize the database:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
codequest/
├── src/
│   ├── backend/          # Node.js backend services
│   ├── web/             # React frontend application
│   └── shared/          # Shared types and utilities
├── infrastructure/      # Infrastructure as Code
├── tests/              # Test suites
├── docs/               # Documentation
└── .github/            # GitHub workflows and templates
```

## Development

### Development Workflow

1. Create a feature branch from `main`
2. Implement changes following our coding standards
3. Write tests for new functionality
4. Submit a pull request for review
5. Address review feedback
6. Merge after approval

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Document public APIs and complex logic

## Deployment

### Environments

- **Development**: Feature testing and integration
- **Staging**: Pre-production verification
- **Production**: Live environment (multi-region)

### Deployment Process

```bash
# Build and test
npm run build
npm run test

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Security

- **Authentication**: OAuth 2.0, SAML, OpenID Connect
- **Authorization**: Role-Based Access Control (RBAC)
- **Data Protection**: AES-256 encryption at rest
- **Network Security**: TLS 1.3, WAF, DDoS protection
- **Compliance**: GDPR, SOC 2, ISO 27001

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   npm run db:diagnose
   ```

2. **Redis Connection Issues**
   ```bash
   npm run redis:diagnose
   ```

3. **Azure DevOps Integration Issues**
   ```bash
   npm run ado:test-connection
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=codequest:* npm run dev
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development process
- Pull request guidelines
- Testing requirements
- Documentation standards

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- **Support**: support@codequest.com
- **Issues**: [GitHub Issues](https://github.com/codequest/codequest/issues)
- **Slack**: [CodeQuest Community](https://codequest.slack.com)

---

Built with ❤️ by the CodeQuest Team