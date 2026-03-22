import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '32rem',
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
          color: '#e4e4e7',
          background: '#16161a',
        }}>
          <h2 style={{ color: '#f87171', margin: '0 0 0.5rem' }}>Something went wrong</h2>
          <pre style={{
            overflow: 'auto',
            padding: '1rem',
            background: '#0d0d0f',
            borderRadius: 8,
            fontSize: '0.8125rem',
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#a78bfa',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
