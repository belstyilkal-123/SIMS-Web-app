/**
 * Central API configuration.
 * All API base URLs come from environment variables — never hardcode localhost.
 * Set VITE_API_URL and VITE_SOCKET_URL in your .env file.
 */

export const API_URL    = import.meta.env.VITE_API_URL    || 'http://localhost:5000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
