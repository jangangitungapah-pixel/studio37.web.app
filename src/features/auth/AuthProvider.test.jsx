import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthProvider.jsx';
import { CAPABILITIES } from './capabilities.js';
import { useAuth } from './useAuth.js';

const firebaseUser = Object.freeze({ email: 'owner@studio37.id', uid: 'owner-1' });
const activeProfile = Object.freeze({
  displayName: 'Studio37 Owner',
  permissionSetId: null,
  role: 'owner',
  status: 'active',
  uid: 'owner-1',
});

function SessionProbe() {
  const { capabilities, permissionSet, profile, signIn, signOut, status, user } = useAuth();

  return (
    <div>
      <p>{status}</p>
      <p>{user?.email ?? 'no-user'}</p>
      <p>{profile?.displayName ?? 'no-profile'}</p>
      <p>{permissionSet?.name ?? 'no-permission-set'}</p>
      <p>{capabilities.join(',') || 'no-capabilities'}</p>
      <button
        type="button"
        onClick={() => signIn({ email: 'owner@studio37.id', password: 'secret-password' })}
      >
        Sign in probe
      </button>
      <button type="button" onClick={signOut}>
        Sign out probe
      </button>
    </div>
  );
}

function createAuthGateway() {
  return {
    configurePersistence: vi.fn().mockResolvedValue(undefined),
    observeSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

function createProfileRepository() {
  return {
    observeByUid: vi.fn(),
  };
}

function createPermissionRepository() {
  return {
    observeById: vi.fn(),
  };
}

describe('AuthProvider profile access boundary', () => {
  it('waits for an active users/{uid} profile before authenticating the app session', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const unsubscribeAuth = vi.fn();
    const unsubscribeProfile = vi.fn();
    let onUserChanged;
    let onProfileChanged;
    gateway.observeSession.mockImplementation((nextUser) => {
      onUserChanged = nextUser;
      return unsubscribeAuth;
    });
    profileRepository.observeByUid.mockImplementation((...args) => {
      onProfileChanged = args[1];
      return unsubscribeProfile;
    });

    const { unmount } = render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(gateway.observeSession).toHaveBeenCalledOnce());
    expect(gateway.configurePersistence.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.observeSession.mock.invocationCallOrder[0],
    );

    act(() => onUserChanged(firebaseUser));

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(profileRepository.observeByUid).toHaveBeenCalledWith(
      'owner-1',
      expect.any(Function),
      expect.any(Function),
    );

    act(() => onProfileChanged(activeProfile));

    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('owner@studio37.id')).toBeInTheDocument();
    expect(screen.getByText('Studio37 Owner')).toBeInTheDocument();

    unmount();
    expect(unsubscribeProfile).toHaveBeenCalledOnce();
    expect(unsubscribeAuth).toHaveBeenCalledOnce();
  });

  it('reacts live to missing, disabled, and reactivated profiles', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    let onProfileChanged;
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged(firebaseUser);
      return vi.fn();
    });
    profileRepository.observeByUid.mockImplementation((...args) => {
      onProfileChanged = args[1];
      return vi.fn();
    });

    render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(profileRepository.observeByUid).toHaveBeenCalledOnce());

    act(() => onProfileChanged(null));
    expect(screen.getByText('profile-missing')).toBeInTheDocument();

    act(() => onProfileChanged({ ...activeProfile, status: 'disabled' }));
    expect(screen.getByText('disabled')).toBeInTheDocument();

    act(() => onProfileChanged(activeProfile));
    expect(screen.getByText('authenticated')).toBeInTheDocument();
  });

  it('fails closed when the profile listener cannot verify access', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    let onProfileError;
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged(firebaseUser);
      return vi.fn();
    });
    profileRepository.observeByUid.mockImplementation((...args) => {
      onProfileError = args[2];
      return vi.fn();
    });

    render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(profileRepository.observeByUid).toHaveBeenCalledOnce());
    act(() => onProfileError(new Error('permission denied')));

    expect(screen.getByText('profile-error')).toBeInTheDocument();
    expect(screen.getByText('no-profile')).toBeInTheDocument();
  });

  it('resolves an operator permission set before authenticating and reacts to live revocation', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const permissionRepository = createPermissionRepository();
    const unsubscribePermissionSet = vi.fn();
    let onPermissionSetChanged;
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged({ email: 'operator@studio37.id', uid: 'operator-1' });
      return vi.fn();
    });
    profileRepository.observeByUid.mockImplementation((uid, onProfileChanged) => {
      onProfileChanged({
        displayName: 'Front Desk',
        permissionSetId: 'front-desk',
        role: 'studio_operator',
        status: 'active',
        uid,
      });
      return vi.fn();
    });
    permissionRepository.observeById.mockImplementation((...args) => {
      onPermissionSetChanged = args[1];
      return unsubscribePermissionSet;
    });

    const { unmount } = render(
      <AuthProvider
        gateway={gateway}
        permissionRepository={permissionRepository}
        profileRepository={profileRepository}
      >
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(permissionRepository.observeById).toHaveBeenCalledOnce());
    expect(permissionRepository.observeById).toHaveBeenCalledWith(
      'front-desk',
      expect.any(Function),
      expect.any(Function),
    );
    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() =>
      onPermissionSetChanged({
        capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.DASHBOARD_VIEW],
        id: 'front-desk',
        name: 'Front Desk Permissions',
        status: 'active',
      }),
    );

    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('Front Desk Permissions')).toBeInTheDocument();
    expect(
      screen.getByText(`${CAPABILITIES.BOOKING_VIEW},${CAPABILITIES.DASHBOARD_VIEW}`),
    ).toBeInTheDocument();

    act(() =>
      onPermissionSetChanged({
        capabilities: [],
        id: 'front-desk',
        name: 'Front Desk Permissions',
        status: 'disabled',
      }),
    );
    expect(screen.getByText('permission-error')).toBeInTheDocument();
    expect(screen.getByText('no-capabilities')).toBeInTheDocument();

    unmount();
    expect(unsubscribePermissionSet).toHaveBeenCalledOnce();
  });

  it('fails closed for a missing or unreadable assigned permission set', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const permissionRepository = createPermissionRepository();
    let onPermissionSetChanged;
    let onPermissionSetError;
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged({ email: 'operator@studio37.id', uid: 'operator-1' });
      return vi.fn();
    });
    profileRepository.observeByUid.mockImplementation((uid, onProfileChanged) => {
      onProfileChanged({
        displayName: 'Front Desk',
        permissionSetId: 'front-desk',
        role: 'studio_operator',
        status: 'active',
        uid,
      });
      return vi.fn();
    });
    permissionRepository.observeById.mockImplementation((...args) => {
      onPermissionSetChanged = args[1];
      onPermissionSetError = args[2];
      return vi.fn();
    });

    render(
      <AuthProvider
        gateway={gateway}
        permissionRepository={permissionRepository}
        profileRepository={profileRepository}
      >
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(permissionRepository.observeById).toHaveBeenCalledOnce());
    act(() => onPermissionSetChanged(null));
    expect(screen.getByText('permission-error')).toBeInTheDocument();

    act(() => onPermissionSetError(new Error('permission denied')));
    expect(screen.getByText('permission-error')).toBeInTheDocument();
    expect(screen.getByText('no-capabilities')).toBeInTheDocument();
  });

  it('authenticates an operator with no permission set using an empty capability list', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const permissionRepository = createPermissionRepository();
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged({ email: 'operator@studio37.id', uid: 'operator-1' });
      return vi.fn();
    });
    profileRepository.observeByUid.mockImplementation((uid, onProfileChanged) => {
      onProfileChanged({
        displayName: 'Unassigned Operator',
        permissionSetId: null,
        role: 'studio_operator',
        status: 'active',
        uid,
      });
      return vi.fn();
    });

    render(
      <AuthProvider
        gateway={gateway}
        permissionRepository={permissionRepository}
        profileRepository={profileRepository}
      >
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('no-capabilities')).toBeInTheDocument();
    expect(permissionRepository.observeById).not.toHaveBeenCalled();
  });

  it('does not grant app access after sign-in until the profile observer resolves active', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const interaction = userEvent.setup();
    let onUserChanged;
    let onProfileChanged;
    gateway.observeSession.mockImplementation((nextUser) => {
      onUserChanged = nextUser;
      nextUser(null);
      return vi.fn();
    });
    gateway.signIn.mockResolvedValue(firebaseUser);
    profileRepository.observeByUid.mockImplementation((...args) => {
      onProfileChanged = args[1];
      return vi.fn();
    });

    render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Sign in probe' }));
    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() => onUserChanged(firebaseUser));
    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() => onProfileChanged(activeProfile));
    expect(screen.getByText('authenticated')).toBeInTheDocument();
  });

  it('fails closed when persistence initialization fails', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    gateway.configurePersistence.mockRejectedValue(
      Object.assign(new Error('Not configured'), { code: 'studio37/auth-not-configured' }),
    );

    render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('no-user')).toBeInTheDocument();
    expect(gateway.observeSession).not.toHaveBeenCalled();
    expect(profileRepository.observeByUid).not.toHaveBeenCalled();
  });

  it('clears profile access and stops its listener after logout succeeds', async () => {
    const gateway = createAuthGateway();
    const profileRepository = createProfileRepository();
    const interaction = userEvent.setup();
    const unsubscribeProfile = vi.fn();
    let onProfileChanged;
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged(firebaseUser);
      return vi.fn();
    });
    gateway.signOut.mockResolvedValue(undefined);
    profileRepository.observeByUid.mockImplementation((...args) => {
      onProfileChanged = args[1];
      onProfileChanged(activeProfile);
      return unsubscribeProfile;
    });

    render(
      <AuthProvider gateway={gateway} profileRepository={profileRepository}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Sign out probe' }));

    expect(gateway.signOut).toHaveBeenCalledOnce();
    expect(unsubscribeProfile).toHaveBeenCalledOnce();
    expect(screen.getByText('unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('no-user')).toBeInTheDocument();
    expect(screen.getByText('no-profile')).toBeInTheDocument();

    act(() => onProfileChanged(activeProfile));
    expect(screen.getByText('unauthenticated')).toBeInTheDocument();
  });
});
