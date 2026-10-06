import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken: string;
    /** Ustawiane, gdy nie udało się odświeżyć tokenu Discorda — trzeba zalogować się ponownie. */
    error?: string | undefined;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    /** Moment wygaśnięcia tokenu dostępu Discorda (ms od epoki). */
    accessTokenExpires?: number | undefined;
    error?: string | undefined;
  }
}
