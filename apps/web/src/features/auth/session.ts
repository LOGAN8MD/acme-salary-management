import { useQuery } from '@tanstack/react-query';
import { currentUser } from './api';

export function useSession() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: currentUser,
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data ? 60_000 : false),
  });
}
export function safeReturnPath(value: unknown) {
  return typeof value === 'string' &&
    /^\/(dashboard|employees)(?:[/?#]|$)/.test(value) &&
    !value.includes('\\')
    ? value
    : '/dashboard';
}
