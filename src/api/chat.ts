import { apiClient, TIMEOUTS } from './client';
import type {
  ChatMessage,
  ChatResponse,
  ChatSessionDetail,
  ChatSessionSummary,
} from '../types/firmware';

/**
 * Send one chat turn.
 *
 * When the backend has a MongoDB chat log, pass the sessionId returned by a
 * previous call (or from a loaded session) and the server-side stored history
 * is used; the first message of a conversation omits it and the response
 * carries the new session's id. History is only needed for the stateless
 * fallback (chat log disabled).
 */
export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string
): Promise<ChatResponse> {
  return apiClient.post<ChatResponse>(
    '/api/chat',
    { message, history, session_id: sessionId ?? null },
    TIMEOUTS.chat
  );
}

// ------------------------------------------------------- chat-log sessions
// These 503 when the backend has no MongoDB chat log configured.

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  return apiClient.get<ChatSessionSummary[]>('/api/chat/sessions', TIMEOUTS.fast);
}

export async function getChatSession(sessionId: string): Promise<ChatSessionDetail> {
  return apiClient.get<ChatSessionDetail>(`/api/chat/sessions/${sessionId}`, TIMEOUTS.fast);
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/chat/sessions/${sessionId}`, TIMEOUTS.fast);
}
