declare module "@supabase/supabase-js" {
  export type SupabaseUser = {
    id: string;
    email?: string | null;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };

  export type Session = {
    access_token?: string | null;
    user?: SupabaseUser | null;
  } | null;

  export type User = SupabaseUser;

  export type AuthChangeEvent = string;

  export type SupabaseClient = {
    auth: {
      getSession(): Promise<{ data: { session: Session } }>;
      onAuthStateChange(
        callback: (event: AuthChangeEvent, session: Session) => void
      ): {
        data: {
          subscription: {
            unsubscribe(): void;
          };
        };
      };
      signInWithPassword(args: {
        email: string;
        password: string;
      }): Promise<{
        data: {
          session: Session;
          user: User | null;
        };
        error: { message: string } | null;
      }>;
      signInWithOAuth(args: {
        provider: "google";
        options?: {
          redirectTo?: string;
        };
      }): Promise<{
        data: {
          provider?: string | null;
          url?: string | null;
        };
        error: { message: string } | null;
      }>;
      signUp(args: {
        email: string;
        password: string;
        options?: {
          data?: Record<string, unknown>;
        };
      }): Promise<{
        data: {
          session: Session;
          user: User | null;
        };
        error: { message: string } | null;
      }>;
      updateUser(args: {
        data: Record<string, unknown>;
      }): Promise<{
        data: {
          user: User | null;
        };
        error: { message: string } | null;
      }>;
      signOut(): Promise<void>;
    };
    from(table: string): any;
  };

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>
  ): SupabaseClient;
}
