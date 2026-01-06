"use client";

import { signOut } from "next-auth/react";

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    console.warn('Received 401 Unauthorized - logging out user');
    await signOut({ callbackUrl: '/login' });
    throw new Error('Unauthorized - session expired');
  }

  return response;
}

export function handleAuthError(response: Response): Response {
  if (response.status === 401) {
    console.warn('Received 401 Unauthorized - logging out user');
    signOut({ callbackUrl: '/login' });
    throw new Error('Unauthorized - session expired');
  }
  return response;
}
