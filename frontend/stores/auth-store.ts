// In-memory storage for access token (safer than localStorage for XSS prevention)
let inMemoryAccessToken: string | null = null

export function getStoredAccessToken(): string | null {
    return inMemoryAccessToken
}

export function setStoredAccessToken(token: string | null): void {
    inMemoryAccessToken = token
}

export function createAuthHeadersFromStore(): Record<string, string> {
    const token = inMemoryAccessToken
    return token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' }
}

export const AUTH_USER_UPDATED_EVENT = "auth-user-updated"

// In-memory storage for user role, email, fullName, and username (safer than localStorage)
let inMemoryUserRole: UserRole = null
let inMemoryUserEmail: string | null = null
let inMemoryFullName: string | null = null
let inMemoryUsername: string | null = null

export type UserRole = 'admin' | 'security' | 'user' | null

export function getStoredUserRole(): UserRole {
    return inMemoryUserRole
}

export function getStoredUserEmail(): string | null {
    return inMemoryUserEmail
}

export function getStoredCurrentUser(): {
    role: UserRole
    email: string | null
    fullName: string | null
    username: string | null
} {
    return {
        role: inMemoryUserRole,
        email: inMemoryUserEmail,
        fullName: inMemoryFullName,
        username: inMemoryUsername,
    }
}

export function setStoredCurrentUser(params: {
    role: string | null | undefined
    email: string | null | undefined
    fullName?: string | null
    username?: string | null
}): void {
    const normalizedRole =
        params.role === 'admin' || params.role === 'security' || params.role === 'user'
            ? params.role
            : null

    inMemoryUserRole = normalizedRole
    inMemoryUserEmail = params.email && params.email.trim().length > 0 ? params.email : null
    inMemoryFullName = params.fullName && params.fullName.trim().length > 0 ? params.fullName : null
    inMemoryUsername = params.username && params.username.trim().length > 0 ? params.username : null

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_USER_UPDATED_EVENT))
    }
}

export function clearStoredCurrentUser(): void {
    inMemoryAccessToken = null
    inMemoryUserRole = null
    inMemoryUserEmail = null
    inMemoryFullName = null
    inMemoryUsername = null

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_USER_UPDATED_EVENT))
    }
}

