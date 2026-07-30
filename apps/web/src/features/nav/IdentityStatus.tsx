import { formatIdentityStatus } from '../identity/format-identity-status';
import { useUserIdentity } from '../identity/IdentityProvider';

export function IdentityStatus() {
  const { userId } = useUserIdentity();

  return (
    <p className="text-sm text-emerald-900" data-testid="nav-identity-status">
      {formatIdentityStatus(userId)}
    </p>
  );
}
