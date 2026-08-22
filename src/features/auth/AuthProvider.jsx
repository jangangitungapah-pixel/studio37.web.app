import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext } from './auth-context.js';
import { firebaseAuthGateway } from './firebaseAuthGateway.js';

const loadingSession = Object.freeze({
  error: null,
  status: 'loading',
  user: null,
});

export function AuthProvider({ children, gateway = firebaseAuthGateway }) {
  const [session, setSession] = useState(loadingSession);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    Promise.resolve()
      .then(() => gateway.configurePersistence())
      .then(() => {
        if (!active) return;

        unsubscribe = gateway.observeSession(
          (user) => {
            if (!active) return;

            setSession({
              error: null,
              status: user ? 'authenticated' : 'unauthenticated',
              user,
            });
          },
          (error) => {
            if (!active) return;

            setSession({ error, status: 'unauthenticated', user: null });
          },
        );
      })
      .catch((error) => {
        if (!active) return;
        setSession({ error, status: 'unauthenticated', user: null });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  const signIn = useCallback(
    async (credentials) => {
      const user = await gateway.signIn(credentials);
      setSession({ error: null, status: 'authenticated', user });
      return user;
    },
    [gateway],
  );

  const signOut = useCallback(async () => {
    await gateway.signOut();
    setSession({ error: null, status: 'unauthenticated', user: null });
  }, [gateway]);

  const value = useMemo(() => ({ ...session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
