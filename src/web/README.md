# CodeQuest Web Frontend

Enterprise-grade React 18+ frontend application for the CodeQuest gamification platform with multi-tenant support and comprehensive security features.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- SSL/TLS certificates for local development
- Environment variables configuration
- Access to Azure DevOps services

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up development certificates:
```bash
npm run security:setup
```

3. Start development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build
- `npm run preview` - Preview production build locally
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage reporting
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

## Technology Stack

- React 18.2.0 - UI framework with server components
- TypeScript 5.0.4 - Type-safe development
- Material UI 5.13.0 - Enterprise component library
- Redux Toolkit 1.9.5 - State management with RTK Query
- React Router 6.14.0 - Application routing
- Axios 1.4.0 - HTTP client with security enhancements
- Jest/Vitest - Testing framework with coverage requirements
- Vite 4.4.0 - Build tool and development server

## Project Structure

```
src/
├── components/     # Reusable UI components
├── config/        # Application configuration
├── features/      # Feature-based modules
├── hooks/         # Custom React hooks
├── layouts/       # Page layouts and templates
├── services/      # API and external services
├── store/         # Redux store configuration
├── styles/        # Global styles and themes
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Security Configuration

### SSL/TLS Setup

1. Place SSL certificates in `./certs/`:
   - `localhost.pem` - SSL certificate
   - `localhost-key.pem` - Private key

### Environment Variables

Create `.env` file based on `.env.example`:

```env
VITE_API_URL=https://api.codequest.com
VITE_AUTH_DOMAIN=auth.codequest.com
VITE_TENANT_ID=your-tenant-id
```

### Security Features

- HTTPS enforced in development and production
- CSRF protection enabled
- Strict CSP headers
- XSS protection
- CORS configuration
- Secure cookie handling
- Rate limiting
- Request retry with circuit breaker

## Multi-tenant Configuration

### Tenant Isolation

- Route-based tenant separation
- Tenant-specific API endpoints
- Isolated state management
- Tenant-aware components

### State Management

- Tenant context provider
- Tenant-specific Redux stores
- Isolated local storage
- Tenant-aware hooks

## Development Guidelines

### Code Style

- ESLint configuration with security rules
- Prettier formatting
- TypeScript strict mode
- Component best practices
- Performance optimization

### Testing Requirements

- Unit tests: 80% coverage minimum
- Component testing with React Testing Library
- E2E testing with Cypress
- Accessibility testing with jest-axe
- Performance testing

## Production Deployment

### Build Optimization

- Code splitting and lazy loading
- Tree shaking
- Asset optimization
- Bundle analysis
- Performance monitoring

### Security Hardening

- Security headers configuration
- Production CSP rules
- Error boundary implementation
- Logging and monitoring setup
- Rate limiting configuration

## Performance Optimization

- React.memo for expensive components
- Virtualization for large lists
- Image optimization
- Code splitting
- Service worker caching
- Bundle size optimization

## Error Handling

- Global error boundary
- API error handling
- Retry mechanisms
- Fallback UI components
- Error logging and monitoring

## Browser Support

### Production

- ">0.2%"
- "not dead"
- "not op_mini all"

### Development

- Last 1 Chrome version
- Last 1 Firefox version
- Last 1 Safari version

## Contributing

1. Follow TypeScript strict mode guidelines
2. Ensure test coverage meets requirements
3. Run security audit before commits
4. Follow component design patterns
5. Document new features and changes

## License

Private - CodeQuest Platform