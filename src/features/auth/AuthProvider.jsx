import { useCallback, useEffect, useMemo, useState } from 'react';

import { userProfileRepository } from '../../services/userProfileRepository.js';
import { AuthContext } from './auth-context.js';
import { firebaseAuthGateway } from './firebaseAuthGateway.js';
import { USER_PROFILE_STATUSES } from './userProfile.js';

const loadingSession = Object.freeze({
  error: null,
  profile: null,
  status: 'loading',
  user: null,
});

const unauthenticatedSession = Object.freeze({
  error: null,
  profile: null,
  status: 'unauthenticated',
  user: null,
});

function resolveProfileSession(user, profile) {
  if (!profile) {
    return { error: null, profile: null, status: 'profile-missing', user };
  }

  if (profile.status === USER_PROFILE_STATUSES.DISABLED) {
    return { error: null, profile, status: 'disabled', user };
  }

  if (profile.status !== USER_PROFILE_STATUSES.ACTIVE) {
    return {
      error: new Error('The Studio37 user profile has an unsupported access status.'),
      profile: null,
      status: 'profile-error',
      user,
    };
  }

  return { error: null, profile, status: 'authenticated', user };
}

export function AuthProvider({
  children,
  gateway = firebaseAuthGateway,
  profileRepository = userProfileRepository,
}) {
  const [session, setSession] = useState(loadingSession);

  useEffect(() => {
    let active = true;
    let observedUid = null;
    let unsubscribeAuth = () => {};
    let unsubscribeProfile = () => {};

    function stopObservingProfile() {
      unsubscribeProfile();
      unsubscribeProfile = () => {};
      observedUid = null;
    }

    function observeUserProfile(user) {
      stopObservingProfile();

      if (!user) {
        setSession(unauthenticatedSession);
        return;
      }

      observedUid = user.uid;
      setSession({ error: null, profile: null, status: 'loading', user });

      try {
        unsubscribeProfile = profileRepository.observeByUid(
          user.uid,
          (profile) => {
            if (!active || observedUid !== user.uid) return;
            setSession(resolveProfileSession(user, profile));
          },
          (error) => {
            if (!active || observedUid !== user.uid) return;
            setSession({ error, profile: null, status: 'profile-error', user });
          },
        );
      } catch (error) {
        setSession({ error, profile: null, status: 'profile-error', user });
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
            setSession({ error, profile: null, status: 'unauthenticated', user: null });
          },
        );
      })
      .catch((error) => {
        if (!active) return;
        stopObservingProfile();
        setSession({ error, profile: null, status: 'unauthenticated', user: null });
      });

    return () => {
      active = false;
      stopObservingProfile();
      unsubscribeAuth();
    };
  }, [gateway, profileRepository]);

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
    setSession(unauthenticatedSession);
  }, [gateway]);

  const value = useMemo(() => ({ ...session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
