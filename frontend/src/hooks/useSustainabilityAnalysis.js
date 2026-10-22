import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeSustainability } from '../services/sustainabilityService.js';

export function useSustainabilityAnalysis(productId) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const requestRef = useRef(null);
  const analyze = useCallback(async () => {
    if (requestRef.current && !requestRef.current.signal.aborted) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: 'loading', data: null, error: null });
    try {
      const response = await analyzeSustainability(productId, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setState({ status: response.cached ? 'cached' : 'success', data: response.data, error: null });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      // Auth failures are redirected to login by ProductCard before this fires;
      // map residual 401/403/429/503 into clean card-level messages.
      let status = 'error';
      let message = error.message || 'Analysis failed. Please try again.';
      if (['AI_UNAVAILABLE', 'AI_CONFIGURATION_ERROR'].includes(error.code) || error.status === 503) {
        status = 'unavailable';
      } else if (error.code === 'INVALID_RESPONSE' || error.code === 'AI_INVALID_RESPONSE') {
        status = 'invalid';
      } else if (error.code === 'SESSION_EXPIRED' || error.status === 401) {
        // We DID send a JWT and the server rejected it: the session ended
        // (expired token, or the server's signing secret rotated after login).
        // The user was signed in a moment ago, so say the session expired
        // rather than implying they were never authenticated.
        message = 'Your session expired. Please sign in again to request AI sustainability analysis.';
      } else if (error.status === 403) {
        message = 'You do not have permission to analyze this product.';
      } else if (error.status === 429) {
        message = 'Too many requests. Please wait a moment and try again.';
      }
      setState({ status, data: null, error: message });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [productId]);

  useEffect(() => () => requestRef.current?.abort(), [productId]);
  return { ...state, analyze };
}
