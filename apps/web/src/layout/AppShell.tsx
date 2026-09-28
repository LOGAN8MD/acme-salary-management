import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { logout } from '../features/auth/api';
import { useSession } from '../features/auth/session';

const width = 248;
export function AppShell() {
  const session = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const desktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: logout,
    retry: false,
    onSuccess: async () => {
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
      client.setQueryData(['auth', 'me'], null);
      void navigate('/login', { replace: true });
    },
  });
  const navigation = (
    <Stack sx={{ height: '100%', p: 3 }}>
      <Stack direction="row" sx={{ mb: 5, alignItems: 'center', gap: 1.5 }}>
        <Avatar
          variant="rounded"
          sx={{ bgcolor: 'primary.main', fontWeight: 800 }}
        >
          A
        </Avatar>
        <div>
          <Typography sx={{ fontWeight: 800 }}>ACME</Typography>
          <Typography variant="caption" color="text.secondary">
            Salary Management
          </Typography>
        </div>
      </Stack>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
        Workspace
      </Typography>
      <List component="nav" aria-label="Main navigation">
        {[
          ['/dashboard', 'Dashboard'],
          ['/employees', 'Employees'],
        ].map(([path, label]) => (
          <ListItemButton
            key={path}
            component={NavLink}
            to={path!}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 1.5,
              mb: 1,
              '&.active': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              },
            }}
          >
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        ACME organization
      </Typography>
      <Typography variant="body2">HR workspace</Typography>
      {!desktop && (
        <Button sx={{ mt: 2 }} onClick={() => setMobileOpen(false)}>
          Close navigation
        </Button>
      )}
    </Stack>
  );
  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'fixed',
          top: -100,
          left: 16,
          zIndex: 1500,
          bgcolor: 'background.paper',
          p: 2,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            id: 'workspace-navigation',
            sx: { width, boxSizing: 'border-box' },
          },
        }}
        sx={{ width: desktop ? width : 0, flexShrink: 0 }}
      >
        {navigation}
      </Drawer>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack
          component="header"
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: { xs: 2, md: 5 },
            py: 2,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            flexWrap: 'wrap',
          }}
        >
          {desktop ? (
            <Typography variant="body2" color="text.secondary">
              People & compensation
            </Typography>
          ) : (
            <Button
              variant="outlined"
              onClick={() => setMobileOpen(true)}
              aria-controls="workspace-navigation"
              aria-expanded={mobileOpen}
            >
              Menu
            </Button>
          )}
          <Stack
            direction="row"
            sx={{ minWidth: 0, ml: 'auto', alignItems: 'center', gap: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  overflowWrap: 'anywhere',
                  maxWidth: { xs: 170, sm: 340 },
                }}
              >
                {session.data?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                HR Manager
              </Typography>
            </Box>
            <Button
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              sx={{ flexShrink: 0 }}
            >
              {signOut.isPending ? 'Signing out…' : 'Sign out'}
            </Button>
          </Stack>
        </Stack>
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            p: { xs: 2, sm: 3, md: 5 },
            maxWidth: 1440,
            mx: 'auto',
            outline: 'none',
          }}
        >
          {signOut.error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {signOut.error.message}
            </Alert>
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
