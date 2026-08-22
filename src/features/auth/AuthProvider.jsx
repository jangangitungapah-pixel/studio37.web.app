import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { permissionSetRepository } from '../../services/permissionSetRepository.js';
import { userProfileRepository } from '../../services/userProfileRepository.js';
import { AuthContext } from './auth-context.js';
import { firebaseAuthGateway } from './firebaseAuthGateway.js';
import { PERMISSION_SET_STATUSES } from './permissionSet.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from './userProfile.js';

const emptyCapabilities = Object.freeze([]);

const loadingSession = Object.freeze({
  capabilities: emptyCapabilities,
  error: null,
  permissionSet: null,
  profile: null,
  status: 'loading',
  user: null,
});

const unauthenticatedSession = Object.freeze({
  capabilities: emptyCapabilities,
  error: null,
  permissionSet: null,
  profile: null,
  status: 'unauthenticated',
  user: null,
});

function createSession({
  capabilities = emptyCapabilities,
  error = null,
  permissionSet = null,
  profile = null,
  status,
  user,
}) {
  return { capabilities, error, permissionSet, profile, status, user };
}

function resolveProfileSession(user, profile) {
  if (!profile) {
    return createSession({ status: 'profile-missing', user });
  }

  if (profile.status === USER_PROFILE_STATUSES.DISABLED) {
    return createSession({ profile, status: 'disabled', user });
  }

  if (profile.status !== USER_PROFILE_STATUSES.ACTIVE) {
    return createSession({
      error: new Error('The Studio37 user profile has an unsupported access status.'),
      status: 'profile-error',
      user,
    });
  }

  if (profile.role === USER_PROFILE_ROLES.OWNER) {
    return createSession({ profile, status: 'authenticated', user });
  }

  if (profile.role === USER_PROFILE_ROLES.STUDIO_OPERATOR && !profile.permissionSetId) {
    return createSession({ profile, status: 'authenticated', user });
  }

  if (profile.role !== USER_PROFILE_ROLES.STUDIO_OPERATOR) {
    return createSession({
      error: new Error('The Studio37 user profile has an unsupported role.'),
      status: 'profile-error',
      user,
    });
  }

  return null;
}

export function AuthProvider({
  children,
  gateway = firebaseAuthGateway,
  permissionRepository = permissionSetRepository,
  profileRepository = userProfileRepository,
}) {
  const [session, setSession] = useState(loadingSession);
  const clearAuthenticatedSessionRef = useRef(() => {});

  useEffect(() => {
    let active = true;
    let observedUid = null;
    let observedPermissionSetId = null;
    let unsubscribeAuth = () => {};
    let unsubscribePermissionSet = () => {};
    let unsubscribeProfile = () => {};

    function stopObservingPermissionSet() {
      unsubscribePermissionSet();
      unsubscribePermissionSet = () => {};
      observedPermissionSetId = null;
    }

    function stopObservingProfile() {
      stopObservingPermissionSet();
      unsubscribeProfile();
      unsubscribeProfile = () => {};
      observedUid = null;
    }

    function clearAuthenticatedSession() {
      stopObservingProfile();
      setSession(unauthenticatedSession);
    }

    clearAuthenticatedSessionRef.current = clearAuthenticatedSession;

    function observePermissionSet(user, profile) {
      stopObservingPermissionSet();
      observedPermissionSetId = profile.permissionSetId;
      setSession(createSession({ profile, status: 'loading', user }));

      try {
        unsubscribePermissionSet = permissionRepository.observeById(
          profile.permissionSetId,
          (resolvedPermissionSet) => {
            if (
              !active ||
              observedUid !== user.uid ||
              observedPermissionSetId !== profile.permissionSetId
            ) {
              return;
            }

            if (
              !resolvedPermissionSet ||
              resolvedPermissionSet.status !== PERMISSION_SET_STATUSES.ACTIVE
            ) {
              setSession(
                createSession({
                  permissionSet: resolvedPermissionSet,
                  profile,
                  status: 'permission-error',
                  user,
                }),
              );
              return;
            }

            setSession(
              createSession({
                capabilities: resolvedPermissionSet.capabilities,
                permissionSet: resolvedPermissionSet,
                profile,
                status: 'authenticated',
                user,
              }),
            );
          },
          (error) => {
            if (
              !active ||
              observedUid !== user.uid ||
              observedPermissionSetId !== profile.permissionSetId
            ) {
              return;
            }

            setSession(createSession({ error, profile, status: 'permission-error', user }));
          },
        );
      } catch (error) {
        setSession(createSession({ error, profile, status: 'permission-error', user }));
      }
    }

    function observeUserProfile(user) {
      stopObservingProfile();

      if (!user) {
        setSession(unauthenticatedSession);
        return;
      }

      observedUid = user.uid;
      setSession(createSession({ status: 'loading', user }));

      try {
        unsubscribeProfile = profileRepository.observeByUid(
          user.uid,
          (profile) => {
            if (!active || observedUid !== user.uid) return;

            stopObservingPermissionSet();
            const resolvedSession = resolveProfileSession(user, profile);

            if (resolvedSession) {
              setSession(resolvedSession);
              return;
            }

            observePermissionSet(user, profile);
          },
          (error) => {
            if (!active || observedUid !== user.uid) return;
            stopObservingPermissionSet();
            setSession(createSession({ error, status: 'profile-error', user }));
          },
        );
      } catch (error) {
        setSession(createSession({ error, status: 'profile-error', user }));
      }
    }

    Promise.resolve()
      .then(() => gateway.configurePersistence())
      .then(() => {
        if (!active) return;

        unsubscribeAuth = gateway.observeSession(
          (user) => {
            if (!active) return;
            observeUserProfile(user);
          },
          (error) => {
            if (!active) return;

            stopObservingProfile();
            setSession(createSession({ error, status: 'unauthenticated', user: null }));
          },
        );
      })
      .catch((error) => {
        if (!active) return;
        stopObservingProfile();
        setSession(createSession({ error, status: 'unauthenticated', user: null }));
      });

    return () => {
      active = false;
      clearAuthenticatedSessionRef.current = () => {};
      stopObservingProfile();
      unsubscribeAuth();
    };
  }, [gateway, permissionRepository, profileRepository]);

  const signIn = useCallback(
    async (credentials) => {
      setSession(loadingSession);

      try {
        return await gateway.signIn(credentials);
      } catch (error) {
        setSession(unauthenticatedSession);
        throw error;
      }
    },
    [gateway],
  );

  const signOut = useCallback(async () => {
    await gateway.signOut();
    clearAuthenticatedSessionRef.current();
  }, [gateway]);

  const value = useMemo(() => ({ ...session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
