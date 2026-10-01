import { useEffect } from "react";

/**
 * Global event name dispatched by the chat widget whenever the AI agent
 * completes a response. Any page component that displays data which
 * the agent may have modified should call this hook with its refetch
 * function so the UI stays in sync without a manual page reload.
 */
export const AGENT_DATA_CHANGED_EVENT = "kindicore-agent-data-changed";

/**
 * Evento disparado cuando se guarda la personalización del agente
 * (nombre, icono, personalidad, zona horaria, sponsors) desde el
 * AgentConfigModal. El ChatWidget lo escucha para recargar la
 * identidad sin necesidad de recargar la página.
 */
export const AGENT_CONFIG_CHANGED_EVENT = "kindicore-agent-config-changed";

/**
 * Dispatch the global refresh event. Called from the chat widget
 * after receiving a successful agent response.
 */
export function dispatchAgentDataChanged() {
    window.dispatchEvent(new CustomEvent(AGENT_DATA_CHANGED_EVENT));
}

/**
 * Dispatch the agent-config refresh event. Called from AgentConfigModal
 * after saving customization so ChatWidget reloads name/icon instantly.
 */
export function dispatchAgentConfigChanged() {
    window.dispatchEvent(new CustomEvent(AGENT_CONFIG_CHANGED_EVENT));
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
