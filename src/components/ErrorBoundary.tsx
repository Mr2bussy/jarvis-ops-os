import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; label?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[JARVIS ErrorBoundary]', this.props.label, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 16, padding: 32,
        }}>
          <div className="hud-label" style={{ fontSize: 11, color: 'var(--rose)', letterSpacing: '0.28em' }}>
            {this.props.label?.toUpperCase() ?? 'SCREEN'} FAULT
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', maxWidth: 540, textAlign: 'center', lineHeight: 1.6 }}>
            {this.state.error.message}
          </div>
          <button onClick={this.reset} className="hud-label"
            style={{
              marginTop: 8, fontSize: 9, padding: '6px 20px', cursor: 'pointer',
              color: 'var(--cyan)', border: '1px solid var(--cyan)', background: 'transparent',
              letterSpacing: '0.22em',
            }}>
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
