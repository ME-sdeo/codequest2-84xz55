import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginForm from '../../src/components/auth/LoginForm';
import RegisterForm from '../../src/components/auth/RegisterForm';
import SSOButtons from '../../src/components/auth/SSOButtons';
import { Role } from '../../src/types/common.types';

// Mock auth hook and service
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithSSO: vi.fn(),
    isLoading: false,
    error: null
  })
}));

vi.mock('../../src/services/auth.service', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    validateToken: vi.fn(),
    refreshToken: vi.fn(),
    handleSSORedirect: vi.fn()
  }
}));

describe('LoginForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all required fields', () => {
    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates empty form submission', async () => {
    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'invalid-email');
    fireEvent.blur(screen.getByLabelText(/email/i));
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('validates password strength requirements', async () => {
    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    await userEvent.type(screen.getByLabelText(/password/i), 'weak');
    fireEvent.blur(screen.getByLabelText(/password/i));
    
    await waitFor(() => {
      expect(screen.getByText(/password does not meet security requirements/i)).toBeInTheDocument();
    });
  });

  it('handles successful login', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth');
    const mockLogin = vi.fn().mockResolvedValue({ user: { id: '1' } });
    (useAuth as jest.Mock).mockImplementation(() => ({
      login: mockLogin,
      isLoading: false,
      error: null
    }));

    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Test123!@#');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Test123!@#'
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('handles login errors', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth');
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    (useAuth as jest.Mock).mockImplementation(() => ({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid credentials'
    }));

    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Test123!@#');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it('implements rate limiting', async () => {
    render(<LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />);
    
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    }
    
    await waitFor(() => {
      expect(screen.getByText(/account locked/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <LoginForm onSuccess={mockOnSuccess} onError={mockOnError} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('RegisterForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all required fields', () => {
    render(
      <RegisterForm 
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        enableSSO={true}
        supportedSSOProviders={['azure-ad', 'okta', 'auth0']}
      />
    );
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('validates registration data', async () => {
    render(
      <RegisterForm 
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        defaultRole={Role.DEVELOPER}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('handles role-specific fields', async () => {
    render(
      <RegisterForm 
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        defaultRole={Role.DEVELOPER}
      />
    );
    
    const roleSelect = screen.getByLabelText(/role/i);
    await userEvent.selectOptions(roleSelect, Role.ORG_ADMIN);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company id/i)).toBeInTheDocument();
    });
  });

  it('handles successful registration', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com' });
    const AuthService = (await import('../../src/services/auth.service')).default;
    AuthService.register = mockRegister;

    render(
      <RegisterForm 
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        defaultRole={Role.DEVELOPER}
      />
    );
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Test123!@#');
    await userEvent.selectOptions(screen.getByLabelText(/role/i), Role.DEVELOPER);
    
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

describe('SSOButtons', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();
  const mockNonce = 'test-nonce';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SSO provider buttons', () => {
    render(
      <SSOButtons
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        nonce={mockNonce}
      />
    );
    
    expect(screen.getByText(/continue with azure ad/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with okta/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with auth0/i)).toBeInTheDocument();
  });

  it('handles SSO authentication flow', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth');
    const mockLoginWithSSO = vi.fn().mockResolvedValue('sso-token');
    (useAuth as jest.Mock).mockImplementation(() => ({
      loginWithSSO: mockLoginWithSSO
    }));

    render(
      <SSOButtons
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        nonce={mockNonce}
      />
    );
    
    fireEvent.click(screen.getByText(/continue with azure ad/i));
    
    await waitFor(() => {
      expect(mockLoginWithSSO).toHaveBeenCalledWith('azure-ad', expect.any(String));
      expect(mockOnSuccess).toHaveBeenCalledWith('azure-ad', 'sso-token');
    });
  });

  it('handles SSO errors with retry mechanism', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth');
    const mockLoginWithSSO = vi.fn()
      .mockRejectedValueOnce(new Error('SSO failed'))
      .mockResolvedValueOnce('sso-token');
    
    (useAuth as jest.Mock).mockImplementation(() => ({
      loginWithSSO: mockLoginWithSSO
    }));

    render(
      <SSOButtons
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        nonce={mockNonce}
      />
    );
    
    fireEvent.click(screen.getByText(/continue with azure ad/i));
    
    await waitFor(() => {
      expect(mockLoginWithSSO).toHaveBeenCalledTimes(2);
      expect(mockOnSuccess).toHaveBeenCalledWith('azure-ad', 'sso-token');
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <SSOButtons
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        nonce={mockNonce}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});