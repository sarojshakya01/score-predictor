export const SESSION_EXPIRED_EVENT = "football-predictor:session-expired";

export const notifySessionExpired = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};

export const subscribeToSessionExpired = (listener: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(SESSION_EXPIRED_EVENT, listener);

  return () => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  };
};
