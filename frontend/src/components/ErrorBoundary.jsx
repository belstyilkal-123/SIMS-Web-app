import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary caught]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 32px', maxWidth: 700, margin: '40px auto',
          background: '#fff', borderRadius: 14, border: '2px solid #ef4444',
          boxShadow: '0 4px 24px rgba(239,68,68,0.15)'
        }}>
          <h2 style={{ color: '#b91c1c', marginBottom: 12 }}>
            ❌ Something went wrong
          </h2>
          <p style={{ color: '#374151', marginBottom: 16 }}>
            A component crashed. The error details are below and in the browser console.
          </p>
          <pre style={{
            background: '#fee2e2', color: '#7f1d1d', padding: '14px 16px',
            borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 16
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null, info: null }); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#15803d', color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
