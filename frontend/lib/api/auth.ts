import { API_BASE_URL } from "./config"

export type UserRole = "admin" | "security" | "user"

export type LoginRequest = {
    email: string
    password: string
}

export type LoginResponse = {
    access_token: string
    refresh_token: string
    user?: CurrentUserResponse
}

export type CurrentUserResponse = {
    id: string
    username: string | null
    email: string | null
    full_name: string | null
    role: UserRole
    created_at?: string | null
    last_login?: string | null
}

/** Error carrying the HTTP status so callers can react to specific codes (e.g. 401). */
export class ApiError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

export async function loginWithApi(payload: LoginRequest): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/user/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const message = await safeReadErrorMessage(res)
        throw new ApiError(message || "Login failed", res.status)
    }

    return (await res.json()) as LoginResponse
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUserResponse> {
    const res = await fetch(`${API_BASE_URL}/user/me`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    })

    if (!res.ok) {
        const message = await safeReadErrorMessage(res)
        throw new ApiError(message || "Failed to fetch current user", res.status)
    }

    return (await res.json()) as CurrentUserResponse
}

export async function refreshAccessToken(): Promise<{ access_token: string; refresh_token: string }> {
    const res = await fetch(`${API_BASE_URL}/user/refresh_token`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    })

    if (!res.ok) {
        const message = await safeReadErrorMessage(res)
        throw new ApiError(message || "Failed to refresh token", res.status)
    }

    return (await res.json()) as { access_token: string; refresh_token: string }
}

/** Clear the refresh-token cookie on the backend (best effort). */
export async function logoutApi(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/user/logout`, {
            method: "POST",
            credentials: "include",
        })
    } catch {
        // Network errors on logout are non-fatal; local state is already cleared.
    }
}

export async function safeReadErrorMessage(res: Response): Promise<string | null> {
    try {
        const data = (await res.json()) as { detail?: string | Array<{ msg?: string }> }
        if (typeof data.detail === "string") return data.detail
        if (Array.isArray(data.detail)) {
            return data.detail.map((d) => d.msg).filter(Boolean).join(", ") || null
        }
        return null
    } catch {
        return null
    }
}
