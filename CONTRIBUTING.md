# Contributing to CodeQuest

## Table of Contents
- [Introduction](#introduction)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Contribution Workflow](#contribution-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)

## Introduction

### Welcome to CodeQuest!
CodeQuest is a SaaS gamification platform that integrates with Azure DevOps to enhance developer productivity through a points-based reward system. Your contributions help make CodeQuest better for development teams worldwide.

### Code of Conduct
All contributors are expected to adhere to our Code of Conduct. Please read it before contributing.

### Quick Start
1. Fork the repository
2. Set up your development environment
3. Make your changes
4. Submit a pull request

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm 9 or higher
- Git

### Repository Structure
```
codequest/
├── frontend/        # React frontend application
├── backend/         # NestJS backend services
├── plugins/         # Azure DevOps plugins
├── docs/           # Documentation
└── scripts/        # Development scripts
```

### Environment Setup
1. Clone your fork:
```bash
git clone https://github.com/your-username/codequest.git
cd codequest
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

### Local Development Workflow
1. Start development servers:
```bash
npm run dev
```

2. Access the application:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000

### Troubleshooting
- Clear npm cache: `npm cache clean --force`
- Reset node_modules: `rm -rf node_modules && npm install`
- Check logs: `npm run logs`

## Coding Standards

### TypeScript Style Guide
We follow the Google TypeScript Style Guide with the following specifications:
- Max line length: 100 characters
- Indentation: 2 spaces
- File naming: kebab-case
- Class naming: PascalCase
- Interface naming: IPascalCase

### React Best Practices
- Use functional components with hooks
- Implement proper error boundaries
- Follow component composition patterns
- Maintain proper prop typing

### NestJS Architecture Patterns
- Follow module-based architecture
- Implement proper dependency injection
- Use decorators appropriately
- Maintain service layer abstraction

### Documentation Requirements
- JSDoc comments for all public APIs
- README updates for new features
- Swagger/OpenAPI documentation for endpoints
- Configuration documentation updates
- Security considerations documentation

## Contribution Workflow

### Branch Naming Conventions
- Features: `feature/description`
- Bug fixes: `bugfix/description`
- Hotfixes: `hotfix/description`
- Releases: `release/version`

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Tests
- chore: Maintenance

### Pull Request Process
1. Create a branch following naming conventions
2. Make your changes
3. Update documentation
4. Run all tests
5. Submit PR using the template
6. Address review feedback

Required PR Sections:
- Description
- Technical Details
- Testing
- Security
- Documentation

Required Checks:
- Backend CI
- Frontend CI
- Security Scan
- Code Coverage

## Testing Guidelines

### Testing Requirements
Coverage thresholds:
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

Required Test Types:
1. Unit Tests
   - Component tests
   - Service tests
   - Utility tests

2. Integration Tests
   - API endpoint tests
   - Service integration tests
   - Database integration tests

3. E2E Tests
   - Critical user flows
   - Authentication flows
   - Points system flows

4. Performance Tests
   - Load testing
   - Response time testing
   - Concurrent user testing

5. Security Tests
   - Authentication tests
   - Authorization tests
   - Input validation tests

## Security Guidelines

### Security Best Practices
- Follow OWASP Top 10 guidelines
- Implement proper input validation
- Use parameterized queries
- Implement proper error handling
- Follow least privilege principle

### Dependency Management
- Weekly dependency updates
- Required npm audit
- Required Snyk scanning
- Automated vulnerability alerts

### Code Scanning
Required scans on every PR:
- SonarQube analysis
- CodeQL scanning
- Dependency scanning

### Vulnerability Reporting Process
1. Report security issues privately
2. Include detailed reproduction steps
3. Specify affected versions
4. Wait for 24-hour initial response

Severity Levels:
- Critical: Immediate attention
- High: 24-hour response
- Medium: 48-hour response
- Low: 72-hour response

### Security Impact Assessment
For each PR, evaluate:
1. Authentication impact
2. Authorization impact
3. Data security impact
4. Infrastructure security impact

### Secure Code Review Checklist
- [ ] Input validation
- [ ] Output encoding
- [ ] Authentication checks
- [ ] Authorization checks
- [ ] Secure communications
- [ ] Proper error handling
- [ ] Secure configuration
- [ ] Dependency security
- [ ] Logging security
- [ ] Data protection

---

For additional assistance, please contact the core team or open an issue.