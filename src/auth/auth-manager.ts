/**
 * Client-side auth state manager
 *
 * Validates session on init, handles register/login/logout,
 * publishes auth state via CustomEvents.
 */

const TOKEN_KEY = 'atlas:token';
const REMEMBER_KEY = 'atlas:remember';

export interface User {
  id: string;
  username: string;
  email: string;
}

class AuthManager {
  private user: User | null = null;
  private token: string | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      this.token = stored;
      void this.validateSession();
    }
  }

  private publish(): void {
    window.dispatchEvent(
      new CustomEvent('auth:user', { detail: this.user })
    );
    window.dispatchEvent(
      new CustomEvent('auth:authenticated', { detail: this.user !== null })
    );
  }

  private storeToken(token: string, remember: boolean): void {
    this.token = token;
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(REMEMBER_KEY);
    }
  }

  private clearToken(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async validateSession(): Promise<boolean> {
    if (!this.token) {
      this.clearToken();
      this.publish();
      return false;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok) {
        const user = (await res.json()) as User;
        this.user = user;
        this.publish();
        return true;
      }
    } catch {
      // Network error
    }

    this.clearToken();
    this.publish();
    return false;
  }

  async register(
    email: string,
    username: string,
    password: string,
    remember = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; user?: User; error?: string };

      if (res.ok && data.success && data.token && data.user) {
        this.storeToken(data.token, remember);
        this.user = data.user;
        this.publish();
        return { success: true };
      }

      return {
        success: false,
        error: data.error ?? (res.status === 409 ? 'Username or email already taken' : 'Registration failed'),
      };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  }

  async login(
    login: string,
    password: string,
    remember = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; user?: User; error?: string };

      if (res.ok && data.success && data.token && data.user) {
        this.storeToken(data.token, remember);
        this.user = data.user;
        this.publish();
        return { success: true };
      }

      return {
        success: false,
        error: data.error ?? (res.status === 429 ? 'Too many attempts. Try again later.' : 'Invalid credentials'),
      };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  }

  async logout(): Promise<void> {
    if (this.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` },
        });
      } catch {
        // Ignore
      }
    }
    this.clearToken();
    this.publish();
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }
}

export const auth = new AuthManager();
