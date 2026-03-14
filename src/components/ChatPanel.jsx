import { useState, useRef, useEffect } from 'react';
import { generateSubtasks, hasOpenAI } from '../lib/subtaskGenerator';

export function ChatPanel({ task, onClose, onAddSubtasks }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: hasOpenAI()
        ? `I can help break down "${task.title}" into subtasks. Describe what you need—e.g. "break this into steps" or "add: research, get quotes, schedule"—or type a list (one per line or comma-separated).`
        : `Type subtasks as a list—one per line, or comma-separated, or "1. Step one" then "2. Step two". I'll parse and add them.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setIsLoading(true);
    setError('');

    try {
      const subtasks = await generateSubtasks(task.title, prompt);

      if (!subtasks?.length) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I couldn't extract any subtasks. Try a clearer list, e.g. one item per line.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Here are ${subtasks.length} subtasks:\n\n${subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nClick "Add to task" to add them.`,
          subtasks,
        },
      ]);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message}. You can still type a list manually (one per line or comma-separated) and I'll parse it.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const suggestedSubtasks = lastMessage?.subtasks;

  const handleAddAll = () => {
    if (suggestedSubtasks?.length) {
      onAddSubtasks(suggestedSubtasks);
      onClose();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>💬 Add subtasks: {task.title}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-content">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      {suggestedSubtasks?.length > 0 && (
        <div className="chat-actions">
          <button className="add-subtasks-btn" onClick={handleAddAll}>
            Add {suggestedSubtasks.length} subtasks to task
          </button>
        </div>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasOpenAI() ? "Describe subtasks or ask AI to break it down..." : "Type subtasks (one per line or comma-separated)"}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
