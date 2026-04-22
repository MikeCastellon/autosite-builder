import { useAuth } from '../lib/AuthContext.jsx';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  return { profile, refreshProfile };
}
