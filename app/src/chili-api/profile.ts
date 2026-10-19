import type { Transport } from './transport';

export interface Profile {
  username: string;
  displayName: string;
}

interface ProfileResponse {
  username: string;
  display_name?: string;
}

export function createProfileService(transport: Transport) {
  return {
    async me(): Promise<Profile> {
      const body = await transport.request<ProfileResponse>('/profiles/me/');
      return { username: body.username, displayName: body.display_name || body.username };
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
