"use client";

import { signOut } from "next-auth/react";

/**
 * Wrapper for fetch that automatically handles 401 errors by logging out the user
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    console.warn('Received 401 Unauthorized - logging out user');
    // User's session is invalid, log them out
    await signOut({ callbackUrl: '/login' });
    throw new Error('Unauthorized - session expired');
  }

  return response;
}

/**
 * Helper to check response status and handle 401
 */
export function handleAuthError(response: Response): Response {
  if (response.status === 401) {
    console.warn('Received 401 Unauthorized - logging out user');
    signOut({ callbackUrl: '/login' });
    throw new Error('Unauthorized - session expired');
  }
  return response;
}
