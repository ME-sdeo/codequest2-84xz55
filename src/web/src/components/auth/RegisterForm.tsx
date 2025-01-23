import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form'; // v7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import { 
  TextField,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Typography,
  IconButton,
  Box
} from '@mui/material'; // v5.0.0
import { Visibility, VisibilityOff } from '@mui/icons-material'; // v5.0.0

import { registerSchema } from '../../validation/auth.schema';
import { User } from '../../types/auth.types';
import AuthService from '../../services/auth.service';
import { Role } from '../../types/common.types';

interface RegisterFormProps {
  onSuccess: (user: User) => void;
  onError: (error: Error) => void;
  enableSSO?: boolean;
  supportedSSOProviders?: string[];
  defaultRole?: Role;
}

interface RegisterFormData {
  email: string;
  password: string;
  role: Role;
  companyId?: string;
  organizationId?: string;
  ssoProvider?: string;
  useSSO: boolean;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
  enableSSO = false,
  supportedSSOProviders = [],
  defaultRole = Role.DEVELOPER
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
      useSSO: false
    }
  });

  const selectedRole = watch('role');
  const useSSO = watch('useSSO');

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleSSOToggle = useCallback((enabled: boolean) => {
    setValue('useSSO', enabled);
    if (enabled) {
      setValue('password', ''); // Clear password when switching to SSO
    }
  }, [setValue]);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      let user: User;

      if (data.useSSO) {
        user = await AuthService.registerWithSSO({
          email: data.email,
          role: data.role,
          ssoProvider: data.ssoProvider!,
          companyId: data.companyId,
          organizationId: data.organizationId
        });
      } else {
        user = await AuthService.register({
          email: data.email,
          password: data.password,
          role: data.role,
          companyId: data.companyId,
          organizationId: data.organizationId
        });
      }

      onSuccess(user);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 400 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl fullWidth error={!!errors.email}>
          <TextField
            {...register('email')}
            label={t('auth.email')}
            type="email"
            error={!!errors.email}
            helperText={errors.email?.message}
            disabled={isLoading}
            InputProps={{
              'aria-label': t('auth.email'),
              'aria-describedby': 'email-error'
            }}
          />
        </FormControl>

        {!useSSO && (
          <FormControl fullWidth error={!!errors.password}>
            <TextField
              {...register('password')}
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={isLoading}
              InputProps={{
                'aria-label': t('auth.password'),
                'aria-describedby': 'password-error',
                endAdornment: (
                  <IconButton
                    aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                    onClick={togglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                )
              }}
            />
          </FormControl>
        )}

        <FormControl fullWidth error={!!errors.role}>
          <InputLabel id="role-select-label">{t('auth.role')}</InputLabel>
          <Select
            {...register('role')}
            labelId="role-select-label"
            label={t('auth.role')}
            error={!!errors.role}
            disabled={isLoading}
          >
            <MenuItem value={Role.DEVELOPER}>{t('roles.developer')}</MenuItem>
            <MenuItem value={Role.GENERAL_USER}>{t('roles.generalUser')}</MenuItem>
            <MenuItem value={Role.ORG_ADMIN}>{t('roles.orgAdmin')}</MenuItem>
            <MenuItem value={Role.COMPANY_ADMIN}>{t('roles.companyAdmin')}</MenuItem>
          </Select>
          {errors.role && (
            <FormHelperText error>{errors.role.message}</FormHelperText>
          )}
        </FormControl>

        {(selectedRole === Role.COMPANY_ADMIN || selectedRole === Role.ORG_ADMIN) && (
          <FormControl fullWidth error={!!errors.companyId}>
            <TextField
              {...register('companyId')}
              label={t('auth.companyId')}
              error={!!errors.companyId}
              helperText={errors.companyId?.message}
              disabled={isLoading}
            />
          </FormControl>
        )}

        {selectedRole === Role.ORG_ADMIN && (
          <FormControl fullWidth error={!!errors.organizationId}>
            <TextField
              {...register('organizationId')}
              label={t('auth.organizationId')}
              error={!!errors.organizationId}
              helperText={errors.organizationId?.message}
              disabled={isLoading}
            />
          </FormControl>
        )}

        {enableSSO && (
          <>
            <Divider>
              <Typography variant="body2" color="textSecondary">
                {t('auth.or')}
              </Typography>
            </Divider>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('auth.ssoOption')}
              </Typography>
              <Stack direction="row" spacing={2}>
                {supportedSSOProviders.map((provider) => (
                  <Button
                    key={provider}
                    variant={useSSO && watch('ssoProvider') === provider ? 'contained' : 'outlined'}
                    onClick={() => {
                      handleSSOToggle(true);
                      setValue('ssoProvider', provider);
                    }}
                    disabled={isLoading}
                  >
                    {t(`auth.ssoProviders.${provider}`)}
                  </Button>
                ))}
              </Stack>
            </Box>
          </>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={isLoading}
          sx={{ mt: 2 }}
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            t('auth.register')
          )}
        </Button>
      </Stack>
    </form>
  );
};

export default RegisterForm;