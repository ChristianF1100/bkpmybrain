import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/** Se WebGL fallisce a runtime, l'app passa alla modalità alternativa (indice dei contenuti). */
export class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[sinapsi] scena 3D non disponibile:', error, info.componentStack);
    this.props.onError();
  }
  render() { return this.state.failed ? null : this.props.children; }
}
