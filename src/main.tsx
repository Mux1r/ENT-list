import {Component, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ponytail: 白屏 = React 整棵樹被卸載且沒人顯示原因。這裡把錯誤印在畫面上。
class ErrorBoundary extends Component {
  declare props: {children?: any};
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <pre style={{padding: 24, whiteSpace: 'pre-wrap', fontSize: 13, color: '#b91c1c'}}>
        {this.state.error.message}
        {'\n\n'}
        {this.state.error.stack}
      </pre>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
