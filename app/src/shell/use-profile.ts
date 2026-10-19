import { useEffect, useState } from 'react';
import type { Profile, ProfileService } from '../chili-api';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'signed-in'; profile: Profile }
  | { status: 'signed-out' };

export function useProfile(service: ProfileService): ProfileState {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    service.me().then(
      (profile) => live && setState({ status: 'signed-in', profile }),
      () => live && setState({ status: 'signed-out' }),
    );
    return () => {
      live = false;
    };
  }, [service]);
  return state;
}
