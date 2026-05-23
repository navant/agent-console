import React from 'react';
import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  msg: ChatMessage;
  agentColor?: string;
}

const CLAUDE_ORANGE = '#e07b39';

export default function MessageBubble({ msg, agentColor }: MessageBubbleProps) {
  if (msg.type === 'system') {
    return (
      <div className="msg msg-system">
        <span className="msg-tag">SYS</span>
        <span className="mono">{msg.text}</span>
      </div>
    );
  }

  if (msg.type === 'text') {
    const borderColor = agentColor ?? CLAUDE_ORANGE;
    return (
      <div className="msg msg-text" style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 10 }}>
        <span className="msg-tag">OUT</span>
        <div className="msg-body">{msg.text}</div>
      </div>
    );
  }

  if (msg.type === 'tool_use') {
    const inputStr = typeof msg.input === 'string'
      ? msg.input
      : JSON.stringify(msg.input, null, 2);
    return (
      <div className="msg msg-tool">
        <span className="msg-tag tag-tool">{msg.tool}</span>
        <code className="mono">{inputStr}</code>
      </div>
    );
  }

  if (msg.type === 'tool_result') {
    return (
      <div className="msg msg-result">
        <span className="msg-tag tag-result">↳</span>
        <pre className="mono">{msg.text}</pre>
      </div>
    );
  }

  if (msg.type === 'user') {
    return (
      <div className="msg msg-user">
        <span className="msg-tag tag-user">YOU</span>
        <div className="msg-body">{msg.text}</div>
      </div>
    );
  }

  return null;
}
