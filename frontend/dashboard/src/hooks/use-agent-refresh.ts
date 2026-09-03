import { useEffect } from "react";

/**
 * Global event name dispatched by the chat widget whenever the AI agent
 * completes a response. Any page component that displays data which
 * the agent may have modified should call this hook with its refetch
 * function so the UI stays in sync without a manual page reload.
 */
export const AGENT_DATA_CHANGED_EVENT = "kindicore-agent-data-changed";

/**
 * Dispatch the global refresh event. Called from the chat widget
 * after receiving a successful agent response.
 */
export function dispatchAgentDataChanged() {
    window.dispatchEvent(new CustomEvent(AGENT_DATA_CHANGED_EVENT));
}

/**
 * Hook: subscribe to agent-triggered data changes.
 * @param refetchFn - the function that reloads the component's data
 */
export function useAgentRefresh(refetchFn: () => void) {
    useEffect(() => {
        const handler = () => refetchFn();
        window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
        return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    }, [refetchFn]);
}
